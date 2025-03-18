import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
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
    const translationMetadata: Record<string, any> = {};
    
    for (const field of fieldsToTranslate) {
      if (!novel[field]) {
        continue;
      }
      
      const translateParams = {
        Text: novel[field],
        SourceLanguageCode: 'en',
        TargetLanguageCode: language as string,
      };
      
      const translationResult = await translate.send(new TranslateTextCommand(translateParams));
      
      translations[`translated_${field}`] = translationResult.TranslatedText;
      
      if (Object.keys(translationMetadata).length === 0) {
        translationMetadata.sourceLanguage = translationResult.SourceLanguageCode;
        translationMetadata.targetLanguage = translationResult.TargetLanguageCode;
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
          message: "Invalid language code. Please use valid ISO language codes (e.g., fr, es, de)" 
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