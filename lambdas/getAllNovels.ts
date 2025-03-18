import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    const queryParams = event.queryStringParameters || {};
    const { author, genre, published } = queryParams;

    let filterExpressionParts: string[] = [];
    let expressionAttributeValues: any = {};

    if (author) {
      filterExpressionParts.push("author = :author");
      expressionAttributeValues[":author"] = author;
    }

    if (genre) {
      filterExpressionParts.push("genre = :genre");
      expressionAttributeValues[":genre"] = genre;
    }

    if (published !== undefined) {
      filterExpressionParts.push("published = :published");
      expressionAttributeValues[":published"] = published === 'true';
    }

    const scanParams: any = {
      TableName: process.env.TABLE_NAME,
    };

    if (filterExpressionParts.length > 0) {
      scanParams.FilterExpression = filterExpressionParts.join(" AND ");
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    const commandOutput = await ddbDocClient.send(new ScanCommand(scanParams));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
        count: commandOutput.Count,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
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