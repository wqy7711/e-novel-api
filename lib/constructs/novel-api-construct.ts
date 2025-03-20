import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface NovelApiProps {
  readonly apiGateway: apigw.RestApi;
  readonly apiKey?: apigw.IApiKey;
  readonly apiUsagePlan?: apigw.IUsagePlan;
  readonly lambdaFunctionProps?: lambda.FunctionProps;
}

export class NovelApiConstruct extends Construct {
  public readonly novelsTable: dynamodb.Table;
  public readonly translationsTable: dynamodb.Table;
  public readonly getAllNovelsFunction: lambdanode.NodejsFunction;
  public readonly getNovelByIdFunction: lambdanode.NodejsFunction;
  public readonly addNovelFunction: lambdanode.NodejsFunction;
  public readonly updateNovelFunction: lambdanode.NodejsFunction;
  public readonly translateNovelFunction: lambdanode.NodejsFunction;

  constructor(scope: Construct, id: string, props: NovelApiProps) {
    super(scope, id);

    // DynamoDB tables
    this.novelsTable = new dynamodb.Table(this, "NovelsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "novelId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ENovels",
    });

    this.translationsTable = new dynamodb.Table(this, "TranslationsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "novelId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "translationKey", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ENovelTranslations",
      timeToLiveAttribute: "ttl",
    });

    // Default Lambda props
    const defaultLambdaProps = {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: this.novelsTable.tableName,
        TRANSLATIONS_TABLE_NAME: this.translationsTable.tableName,
        REGION: 'eu-west-1',
      },
      ...props.lambdaFunctionProps,
    };

    // Lambda functions
    this.getAllNovelsFunction = new lambdanode.NodejsFunction(this, "GetAllNovelsFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../../lambdas/getAllNovels.ts`,
    });

    this.getNovelByIdFunction = new lambdanode.NodejsFunction(this, "GetNovelByIdFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../../lambdas/getNovelById.ts`,
    });

    this.addNovelFunction = new lambdanode.NodejsFunction(this, "AddNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../../lambdas/addNovel.ts`,
    });

    this.updateNovelFunction = new lambdanode.NodejsFunction(this, "UpdateNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../../lambdas/updateNovel.ts`,
    });

    this.translateNovelFunction = new lambdanode.NodejsFunction(this, "TranslateNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../../lambdas/translateNovel.ts`,
    });

    // Permissions
    this.novelsTable.grantReadData(this.getAllNovelsFunction);
    this.novelsTable.grantReadData(this.getNovelByIdFunction);
    this.novelsTable.grantReadWriteData(this.addNovelFunction);
    this.novelsTable.grantReadWriteData(this.updateNovelFunction);
    this.novelsTable.grantReadData(this.translateNovelFunction);
    this.translationsTable.grantReadWriteData(this.translateNovelFunction);
    this.translateNovelFunction.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("TranslateReadOnly")
    );

    // API resources and methods
    this.createApiEndpoints(props.apiGateway, props.apiKey, props.apiUsagePlan);
  }

  private createApiEndpoints(
    api: apigw.RestApi, 
    apiKey?: apigw.IApiKey,
    usagePlan?: apigw.IUsagePlan
  ): void {
    const novelsResource = api.root.addResource("novels");
    const novelIdResource = novelsResource.addResource("{novelId}");
    const translationResource = novelIdResource.addResource("translation");

    novelsResource.addMethod("GET", new apigw.LambdaIntegration(this.getAllNovelsFunction));
    
    if (apiKey && usagePlan) {
      novelsResource.addMethod("POST", 
        new apigw.LambdaIntegration(this.addNovelFunction), 
        { apiKeyRequired: true }
      );
    } else {
      novelsResource.addMethod("POST", new apigw.LambdaIntegration(this.addNovelFunction));
    }

    novelIdResource.addMethod("GET", new apigw.LambdaIntegration(this.getNovelByIdFunction));
    
    if (apiKey && usagePlan) {
      novelIdResource.addMethod("PUT", 
        new apigw.LambdaIntegration(this.updateNovelFunction), 
        { apiKeyRequired: true }
      );
    } else {
      novelIdResource.addMethod("PUT", new apigw.LambdaIntegration(this.updateNovelFunction));
    }

    translationResource.addMethod("GET", new apigw.LambdaIntegration(this.translateNovelFunction));
  }
}