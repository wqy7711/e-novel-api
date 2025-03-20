import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface LambdaStackProps extends cdk.StackProps {
  novelsTable: dynamodb.ITable;
  translationsTable: dynamodb.ITable;
}

export class LambdaStack extends cdk.Stack {
  public readonly getAllNovelsFunction: lambdanode.NodejsFunction;
  public readonly getNovelByIdFunction: lambdanode.NodejsFunction;
  public readonly addNovelFunction: lambdanode.NodejsFunction;
  public readonly updateNovelFunction: lambdanode.NodejsFunction;
  public readonly translateNovelFunction: lambdanode.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Lambda props
    const defaultLambdaProps = {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: props.novelsTable.tableName,
        TRANSLATIONS_TABLE_NAME: props.translationsTable.tableName,
        REGION: this.region,
      },
    };

    // Lambda functions
    this.getAllNovelsFunction = new lambdanode.NodejsFunction(this, "GetAllNovelsFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../lambdas/getAllNovels.ts`,
    });

    this.getNovelByIdFunction = new lambdanode.NodejsFunction(this, "GetNovelByIdFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../lambdas/getNovelById.ts`,
    });

    this.addNovelFunction = new lambdanode.NodejsFunction(this, "AddNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../lambdas/addNovel.ts`,
    });

    this.updateNovelFunction = new lambdanode.NodejsFunction(this, "UpdateNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../lambdas/updateNovel.ts`,
    });

    this.translateNovelFunction = new lambdanode.NodejsFunction(this, "TranslateNovelFunction", {
      ...defaultLambdaProps,
      entry: `${__dirname}/../lambdas/translateNovel.ts`,
    });

    // Permissions
    props.novelsTable.grantReadData(this.getAllNovelsFunction);
    props.novelsTable.grantReadData(this.getNovelByIdFunction);
    props.novelsTable.grantReadWriteData(this.addNovelFunction);
    props.novelsTable.grantReadWriteData(this.updateNovelFunction);
    props.novelsTable.grantReadData(this.translateNovelFunction);
    props.translationsTable.grantReadWriteData(this.translateNovelFunction);
    this.translateNovelFunction.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("TranslateReadOnly")
    );

    new cdk.CfnOutput(this, "GetAllNovelsFunctionArn", {
      value: this.getAllNovelsFunction.functionArn,
      exportName: "GetAllNovelsFunctionArn",
    });

    new cdk.CfnOutput(this, "GetNovelByIdFunctionArn", {
      value: this.getNovelByIdFunction.functionArn,
      exportName: "GetNovelByIdFunctionArn",
    });

    new cdk.CfnOutput(this, "AddNovelFunctionArn", {
      value: this.addNovelFunction.functionArn,
      exportName: "AddNovelFunctionArn",
    });

    new cdk.CfnOutput(this, "UpdateNovelFunctionArn", {
      value: this.updateNovelFunction.functionArn,
      exportName: "UpdateNovelFunctionArn",
    });

    new cdk.CfnOutput(this, "TranslateNovelFunctionArn", {
      value: this.translateNovelFunction.functionArn,
      exportName: "TranslateNovelFunctionArn",
    });
  }
}