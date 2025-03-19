import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { novels } from "../seed/novels";

export class ENovelApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const eNovelsTable = new dynamodb.Table(this, "ENovelsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "novelId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ENovels",
    });

    // Lambda Functions
    const getAllNovelsFn = new lambdanode.NodejsFunction(
      this,
      "GetAllNovelsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllNovels.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: eNovelsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );
    
    const getNovelByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetNovelByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getNovelById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: eNovelsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );
    
    const addNovelFn = new lambdanode.NodejsFunction(
      this,
      "AddNovelFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/addNovel.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: eNovelsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const updateNovelFn = new lambdanode.NodejsFunction(
      this,
      "UpdateNovelFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateNovel.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: eNovelsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const translateNovelFn = new lambdanode.NodejsFunction(
      this,
      "TranslateNovelFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/translateNovel.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: eNovelsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    // Permissions
    eNovelsTable.grantReadData(getAllNovelsFn);
    eNovelsTable.grantReadData(getNovelByIdFn);
    eNovelsTable.grantReadWriteData(addNovelFn);
    eNovelsTable.grantReadWriteData(updateNovelFn);
    eNovelsTable.grantReadData(translateNovelFn);
    translateNovelFn.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("TranslateReadOnly")
    );

    // REST API
    const api = new apig.RestApi(this, "ENovelRestAPI", {
      description: "E-Novel API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date", "x-api-key"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // API key
    const apiKey = new apig.ApiKey(this, "ENovelsApiKey", {
      apiKeyName: "e-novels-api-key",
      description: "API Key for E-Novel API protected endpoints",
    });

    // Usage plan
    const usagePlan = new apig.UsagePlan(this, "ENovelsUsagePlan", {
      name: "ENovelsUsagePlan",
      apiStages: [
        {
          api,
          stage: api.deploymentStage,
        },
      ],
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
      quota: {
        limit: 1000,
        period: apig.Period.MONTH,
      },
    });
    usagePlan.addApiKey(apiKey);

    // API Endpoints
    const novelsEndpoint = api.root.addResource("novels");
    
    // Get all novels
    novelsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllNovelsFn, { proxy: true })
    );
    
    // Add a new novel
    novelsEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(addNovelFn, { proxy: true }),
      {
        apiKeyRequired: true,
      }
    );
    
    // Get a novel by ID
    const novelByIdEndpoint = novelsEndpoint.addResource("{novelId}");
    novelByIdEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getNovelByIdFn, { proxy: true })
    );

    // Update a novel
    novelByIdEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateNovelFn, { proxy: true }),
      {
        apiKeyRequired: true,
      }
    );

    // Get novel with specified fields translated to the requested language
    const translationEndpoint = novelByIdEndpoint.addResource("translation");
    translationEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(translateNovelFn, { proxy: true })
    );
    
    // Seed the database
    new custom.AwsCustomResource(this, "enovelsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [eNovelsTable.tableName]: generateBatch(novels),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("enovelsddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [eNovelsTable.tableArn],
      }),
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "The URL of the deployed API",
    });

    new cdk.CfnOutput(this, "ApiKeyValue", {
      value: apiKey.keyId,
      description: "API Key ID",
    });
    
  }
}