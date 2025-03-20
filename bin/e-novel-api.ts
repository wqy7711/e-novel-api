#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { ApiEndpointsStack } from '../lib/api-endpoints-stack';

const app = new cdk.App();

const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: 'eu-west-1' 
};

const databaseStack = new DatabaseStack(app, 'ENovelDatabaseStack', { env });
const apiGatewayStack = new ApiGatewayStack(app, 'ENovelApiGatewayStack', { env });

const lambdaStack = new LambdaStack(app, 'ENovelLambdaStack', {
  env,
  novelsTable: databaseStack.novelsTable,
  translationsTable: databaseStack.translationsTable,
});

const apiEndpointsStack = new ApiEndpointsStack(app, 'ENovelApiEndpointsStack', {
  env,
  api: apiGatewayStack.api,
  apiKey: apiGatewayStack.apiKey,
  usagePlan: apiGatewayStack.usagePlan,
  getAllNovelsFunction: lambdaStack.getAllNovelsFunction,
  getNovelByIdFunction: lambdaStack.getNovelByIdFunction,
  addNovelFunction: lambdaStack.addNovelFunction,
  updateNovelFunction: lambdaStack.updateNovelFunction,
  translateNovelFunction: lambdaStack.translateNovelFunction,
});

apiEndpointsStack.addDependency(apiGatewayStack);
apiEndpointsStack.addDependency(lambdaStack);
lambdaStack.addDependency(databaseStack);