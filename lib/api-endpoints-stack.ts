import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ApiEndpointsStackProps extends cdk.StackProps {
  api: apigw.RestApi;
  apiKey: apigw.IApiKey;
  usagePlan: apigw.IUsagePlan;
  getAllNovelsFunction: lambda.IFunction;
  getNovelByIdFunction: lambda.IFunction;
  addNovelFunction: lambda.IFunction;
  updateNovelFunction: lambda.IFunction;
  translateNovelFunction: lambda.IFunction;
}

export class ApiEndpointsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiEndpointsStackProps) {
    super(scope, id, props);

    // API resources and methods
    const novelsResource = props.api.root.addResource("novels");
    const novelIdResource = novelsResource.addResource("{novelId}");
    const translationResource = novelIdResource.addResource("translation");

    novelsResource.addMethod(
      "GET", 
      new apigw.LambdaIntegration(props.getAllNovelsFunction)
    );

    novelsResource.addMethod(
      "POST", 
      new apigw.LambdaIntegration(props.addNovelFunction),
      { apiKeyRequired: true }
    );

    novelIdResource.addMethod(
      "GET", 
      new apigw.LambdaIntegration(props.getNovelByIdFunction)
    );

    novelIdResource.addMethod(
      "PUT", 
      new apigw.LambdaIntegration(props.updateNovelFunction),
      { apiKeyRequired: true }
    );

    translationResource.addMethod(
      "GET", 
      new apigw.LambdaIntegration(props.translateNovelFunction)
    );
  }
}