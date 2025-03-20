import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { NovelApiConstruct } from "./constructs/novel-api-construct";
import { generateBatch } from "../shared/util";
import { novels } from "../seed/novels";

export class ENovelApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // API Gateway
    const api = new apigw.RestApi(this, "ENovelRestAPI", {
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

    // API Key
    const apiKey = new apigw.ApiKey(this, "ENovelsApiKey", {
      apiKeyName: "e-novels-api-key",
      description: "API Key for E-Novel API protected endpoints",
    });

    // Usage plan
    const usagePlan = new apigw.UsagePlan(this, "ENovelsUsagePlan", {
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
        period: apigw.Period.MONTH,
      },
    });

    usagePlan.addApiKey(apiKey);

    const novelApi = new NovelApiConstruct(this, "NovelApi", {
      apiGateway: api,
      apiKey: apiKey,
      apiUsagePlan: usagePlan,
    });

    // Seed the database
    new custom.AwsCustomResource(this, "enovelsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [novelApi.novelsTable.tableName]: generateBatch(novels),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("enovelsddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [novelApi.novelsTable.tableArn],
      }),
    });

    new cdk.CfnOutput(this, "ApiKeyValue", {
      value: apiKey.keyId,
      description: "API Key ID (Use this ID to retrieve the actual key value)",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });
  }
}