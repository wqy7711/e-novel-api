import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigw.RestApi;
  public readonly apiKey: apigw.ApiKey;
  public readonly usagePlan: apigw.UsagePlan;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // API Gateway
    this.api = new apigw.RestApi(this, "ENovelRestAPI", {
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
    this.apiKey = new apigw.ApiKey(this, "ENovelsApiKey", {
      apiKeyName: "e-novels-api-key",
      description: "API Key for E-Novel API protected endpoints",
    });

    // Usage plan
    this.usagePlan = new apigw.UsagePlan(this, "ENovelsUsagePlan", {
      name: "ENovelsUsagePlan",
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
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

    this.usagePlan.addApiKey(this.apiKey);

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      exportName: "ApiGatewayUrl",
    });

    new cdk.CfnOutput(this, "ApiKeyId", {
      value: this.apiKey.keyId,
      exportName: "ApiKeyId",
      description: "API Key ID",
    });
  }
}