## Serverless REST Assignment - Distributed Systems.

__Name:__ QiYi Wang

__Demo:__ https://youtu.be/h1398qQLnJI

### Context.

Context: E-Novel Management API

Table item attributes:
+ novelId - string (Partition key)
+ title - string
+ author - string
+ description - string
+ published - boolean
+ pageCount - number
+ genre - string
+ rating - number


### App API endpoints.
 
+ GET /novels - Get all novels with optional filtering by author, genre, or published status
+ GET /novels/{novelId} - Get a specific novel by ID
+ POST /novels - Add a new novel (Protected with API Key)
+ PUT /novels/{novelId} - Update existing novel details (Protected with API Key)
+ GET /novels/{novelId}/translation?language=fr&fields=title,description,genre - Get novel with specified fields translated to the requested language


### Features.

#### Translation persistence (if completed)

[
+ novelId - string (Partition key)
+ translationKey - string (Sort key)
+ translatedText - string
+ sourceLanguage - string 
+ targetLanguage - string
+ originalText - string
+ timestamp - string
+ ttl - number
]

#### Custom L2 Construct (if completed)

[
The NovelApiConstruct creates a complete set of infrastructure for the E-Novel API including tables, Lambda functions, permissions, and API Gateway endpoints.

Construct Input props object:
~~~
interface NovelApiProps {
  readonly apiGateway: apigw.RestApi;
  readonly apiKey?: apigw.IApiKey;
  readonly apiUsagePlan?: apigw.IUsagePlan;
  readonly lambdaFunctionProps?: lambda.FunctionProps;
}
~~~
Construct public properties
~~~
export class NovelApiConstruct extends Construct {
  public readonly novelsTable: dynamodb.Table;
  public readonly translationsTable: dynamodb.Table;
  public readonly getAllNovelsFunction: lambdanode.NodejsFunction;
  public readonly getNovelByIdFunction: lambdanode.NodejsFunction;
  public readonly addNovelFunction: lambdanode.NodejsFunction;
  public readonly updateNovelFunction: lambdanode.NodejsFunction;
  public readonly translateNovelFunction: lambdanode.NodejsFunction;
}
~~~
 ]

#### Multi-Stack app (if completed)

[
+ DatabaseStack
+ ApiGatewayStack
+ LambdaStack
+ ApiEndpointsStack
]


#### API Keys. (if completed)

[
The API uses API key authentication to protect POST and PUT endpoints. 

Create an API key and usage plan in the API Gateway stack:
~~~
const apiKey = new apigw.ApiKey(this, "ENovelsApiKey", {
  apiKeyName: "e-novels-api-key",
  description: "API Key for E-Novel API protected endpoints",
});
const usagePlan = new apigw.UsagePlan(this, "ENovelsUsagePlan", {
  name: "ENovelsUsagePlan",
  apiStages: [{ api, stage: api.deploymentStage }],
  throttle: { rateLimit: 10, burstLimit: 20 },
  quota: { limit: 1000, period: apigw.Period.MONTH },
});
usagePlan.addApiKey(apiKey);
~~~

Require the API key for specific endpoints:
~~~
novelsResource.addMethod(
  "POST", 
  new apigw.LambdaIntegration(addNovelFunction),
  { apiKeyRequired: true }
);
novelIdResource.addMethod(
  "PUT", 
  new apigw.LambdaIntegration(updateNovelFunction),
  { apiKeyRequired: true }
);
~~~

Configure CORS to allow the API key header:
~~~
defaultCorsPreflightOptions: {
  allowHeaders: ["Content-Type", "X-Amz-Date", "x-api-key"],
  allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
  allowCredentials: true,
  allowOrigins: ["*"],
},
~~~
]


###  Extra (If relevant).

[
The application implements Time-to-Live (TTL) on the translations table to automatically clean up old translations after 30 days, helping to manage storage costs
The translation endpoint includes intelligent caching with detailed logging that reports when translations are fetched from cache versus newly translated
]
