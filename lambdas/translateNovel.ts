import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  BatchGetCommand,
  PutCommand 
} from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const ddbDocClient = createDDbDocClient();
const translate = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));
    
    const novelId = event.pathParameters?.novelId;
    if (!novelId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing novelId in path parameters" }),
      };
    }
    
    const language = event.queryStringParameters?.language;
    if (!language) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing language query parameter" }),
      };
    }
    
    const fieldsToTranslate = event.queryStringParameters?.fields?.split(',') || ["description"];
    
    const validTextFields = ["title", "description", "genre", "author"];
    const invalidFields = fieldsToTranslate.filter(field => !validTextFields.includes(field));
    
    if (invalidFields.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ 
          message: `Invalid fields for translation: ${invalidFields.join(', ')}. Valid fields are: ${validTextFields.join(', ')}` 
        }),
      };
    }
    
    const getResult = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { novelId },
      })
    );
    
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: `Novel with ID ${novelId} not found` }),
      };
    }
    
    const novel = getResult.Item;
    const translations: Record<string, string> = {};
    const translationMetadata: Record<string, any> = {
      sourceLanguage: 'en',
      targetLanguage: language
    };
    
    const translationKeys = fieldsToTranslate.map(field => ({
      novelId,
      translationKey: `${field}_${language}`
    }));
    
    const existingTranslationsResponse = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [process.env.TRANSLATIONS_TABLE_NAME!]: {
            Keys: translationKeys
          }
        }
      })
    );
    
    const existingTranslations = existingTranslationsResponse.Responses?.[process.env.TRANSLATIONS_TABLE_NAME!] || [];
    const existingTranslationsMap = new Map();
    
    existingTranslations.forEach(item => {
      existingTranslationsMap.set(item.translationKey, item.translatedText);
    });
    
    for (const field of fieldsToTranslate) {
      if (!novel[field]) {
        continue;
      }
      
      const translationKey = `${field}_${language}`;
      
      if (existingTranslationsMap.has(translationKey)) {
        console.log(`Using cached translation for ${translationKey}`);
        translations[`translated_${field}`] = existingTranslationsMap.get(translationKey);
      } else {
        console.log(`Requesting new translation for ${translationKey}`);
        const translateParams = {
          Text: novel[field],
          SourceLanguageCode: 'en',
          TargetLanguageCode: language,
        };
        
        const translationResult = await translate.send(new TranslateTextCommand(translateParams));
        const translatedText = translationResult.TranslatedText;
        
        translations[`translated_${field}`] = translatedText;
        
        await ddbDocClient.send(
          new PutCommand({
            TableName: process.env.TRANSLATIONS_TABLE_NAME!,
            Item: {
              novelId,
              translationKey,
              translatedText,
              sourceLanguage: translationResult.SourceLanguageCode,
              targetLanguage: translationResult.TargetLanguageCode,
              originalText: novel[field],
              timestamp: new Date().toISOString(),
              ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
            }
          })
        );
        
        if (!translationMetadata.sourceLanguage) {
          translationMetadata.sourceLanguage = translationResult.SourceLanguageCode;
          translationMetadata.targetLanguage = translationResult.TargetLanguageCode;
        }
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ 
        data: {
          ...novel,
          ...translations,
          translation: {
            sourceLanguage: translationMetadata.sourceLanguage,
            targetLanguage: translationMetadata.targetLanguage,
            translatedFields: Object.keys(translations).map(k => k.replace('translated_', ''))
          }
        }
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    
    if (error.name === 'UnsupportedLanguagePairException') {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Unsupported language pair for translation" }),
      };
    }
    
    if (error.name === 'InvalidParameterValueException') {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ 
          message: "Invalid language code. Please use valid ISO language codes" 
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}