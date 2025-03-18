#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ENovelApiStack } from '../lib/e-novel-api-stack';

const app = new cdk.App();
new ENovelApiStack(app, 'ENovelApiStack', {
  env: { region: 'eu-west-1' },
});