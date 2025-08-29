#!/usr/bin/env node
// bin/cpi-bedrock-infrastructure.ts

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { devConfig } from '../lib/config/dev-config';

const app = new cdk.App();

// 環境設定（現在は開発環境のみ）
const config = devConfig;

// AWSアカウント・リージョン設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// ネットワークスタック作成
const networkStack = new NetworkStack(app, `${config.environment}-network-stack`, {
  env,
  config,
  description: `Network infrastructure for ${config.environment} environment`,
});

// データベーススタック作成（ネットワークスタックに依存）
const databaseStack = new DatabaseStack(app, `${config.environment}-database-stack`, {
  env,
  config,
  vpc: networkStack.networkConstruct.vpc,
  auroraSecurityGroup: networkStack.networkConstruct.auroraSecurityGroup,
  description: `Database infrastructure for ${config.environment} environment`,
});

// スタック間の依存関係を明示
databaseStack.addDependency(networkStack);

// 共通タグを全スタックに適用
Object.entries(config.tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

// コスト管理タグ
cdk.Tags.of(app).add('CostCenter', config.environment);
cdk.Tags.of(app).add('AutoShutdown', config.environment === 'dev' ? 'true' : 'false');