import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { novels } from "../seed/novels";

export class DatabaseStack extends cdk.Stack {
  public readonly novelsTable: dynamodb.Table;
  public readonly translationsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Novels table
    this.novelsTable = new dynamodb.Table(this, "ENovelsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "novelId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ENovels",
    });

    // Translations table
    this.translationsTable = new dynamodb.Table(this, "TranslationsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "novelId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "translationKey", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ENovelTranslations",
      timeToLiveAttribute: "ttl",
    });

    // Seed the table
    new custom.AwsCustomResource(this, "enovelsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [this.novelsTable.tableName]: generateBatch(novels),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("enovelsddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [this.novelsTable.tableArn],
      }),
    });

    new cdk.CfnOutput(this, "NovelsTableName", {
      value: this.novelsTable.tableName,
      exportName: "NovelsTableName",
    });

    new cdk.CfnOutput(this, "NovelsTableArn", {
      value: this.novelsTable.tableArn,
      exportName: "NovelsTableArn",
    });

    new cdk.CfnOutput(this, "TranslationsTableName", {
      value: this.translationsTable.tableName,
      exportName: "TranslationsTableName",
    });

    new cdk.CfnOutput(this, "TranslationsTableArn", {
      value: this.translationsTable.tableArn,
      exportName: "TranslationsTableArn",
    });
  }
}