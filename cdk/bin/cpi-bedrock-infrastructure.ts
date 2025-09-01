// bin/cpi-bedrock-infrastructure.ts

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RagchatCommonStack } from '../lib/stacks/ragchat-common-stack';
import { RagchatServiceStack } from '../lib/stacks/ragchat-service-stack';
import { RagchatFrontendStack } from '../lib/stacks/ragchat-frontend-stack'; // 新規追加
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

// 1. 共通インフラスタック
const commonStack = new RagchatCommonStack(app, `${environment}-RagchatCommon`, {
  ...stackProps,
  config,
});

// 2. サービススタック
const serviceStack = new RagchatServiceStack(app, `${environment}-RagchatService`, {
  ...stackProps,
  config,
  knowledgeBaseId: commonStack.knowledgeBase.attrKnowledgeBaseId,
  knowledgeBaseRegion: stackProps.env?.region,
});

// 3. フロントエンドスタック
const frontendStack = new RagchatFrontendStack(app, `${environment}-RagchatFrontend`, {
  ...stackProps,
  config,
});

// 依存関係の明示
serviceStack.addDependency(commonStack);
frontendStack.addDependency(serviceStack);

// スタック間で値を受け渡すための出力設定（Service Stack側で既に実装済み）