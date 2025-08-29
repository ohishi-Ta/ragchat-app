// lib/config/dev-config.ts

import { EnvironmentConfig, commonDefaults } from './environment-config';

export const devConfig: EnvironmentConfig = {
  environment: 'dev',
  
  network: {
    ...commonDefaults.network,
    vpcCidr: '10.0.0.0/16',
    enableNatGateway: false, // コスト削減のためNATゲートウェイなし
    
    naming: {
      vpcName: 'cpi-bedrock-dev-vpc',
      publicSubnetName: 'cpi-bedrock-dev-public',
      privateSubnetName: 'cpi-bedrock-dev-private',
      auroraSecurityGroupName: 'cpi-bedrock-dev-aurora-sg',
      lambdaSecurityGroupName: 'cpi-bedrock-dev-lambda-sg',
    },
  },
  
  aurora: {
    ...commonDefaults.aurora,
    databaseName: 'bedrock_knowledge_base_dev',
    minCapacity: 0.5,
    maxCapacity: 16, // 開発環境は最大16ACU
    deletionProtection: false, // 開発環境では削除保護無効
    backupRetentionDays: 7,
    
    naming: {
      clusterName: 'cpi-bedrock-dev-cluster',
      subnetGroupName: 'cpi-bedrock-dev-subnet-group',
      masterSecretName: 'cpi-bedrock-dev-master-secret',
      appUserSecretName: 'cpi-bedrock-dev-app-secret',
    },
  },
  
  security: {
    ...commonDefaults.security,
    enableVpcFlowLogs: false, // コスト削減
  },
  
  tags: {
    ...commonDefaults.tags,
    Environment: 'dev',
    Owner: 'oishi',
    CostCenter: 'development',
  },
  
  cost: {
    budgetLimitUsd: 100, // 月100ドル上限
    enableBudgetAlerts: true,
  },
};