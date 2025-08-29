// bin/cpi-bedrock-infrastructure.ts

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RagchatCommonStack } from '../lib/stacks/ragchat-common-stack';
import { RagchatServiceStack } from '../lib/stacks/ragchat-service-stack';
import { createConfig, getValidEnvironment } from '../lib/config/environment-config';

const app = new cdk.App();

// 環境を取得（CDKコンテキスト > 環境変数 > デフォルト）
const environmentValue = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';
const environment = getValidEnvironment(environmentValue);

console.log(`Deploying for environment: ${environment}`);

// 環境別の設定を生成
const config = createConfig(environment);

// 共通のスタックプロパティ
const stackProps: cdk.StackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  description: `Infrastructure for ${environment} environment`,
};

// 共通インフラスタック（既存）
const commonStack = new RagchatCommonStack(app, `${environment}-RagchatCommon`, {
  ...stackProps,
  config,
});

// サービススタック（新規）
const serviceStack = new RagchatServiceStack(app, `${environment}-RagchatService`, {
  ...stackProps,
  config,
  knowledgeBaseId: commonStack.knowledgeBase.attrKnowledgeBaseId,
  knowledgeBaseRegion: stackProps.env?.region,
});
