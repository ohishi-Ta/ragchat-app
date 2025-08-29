// lib/config/environment-config.ts

export interface EnvironmentConfig {
  environment: 'dev' | 'staging' | 'prod';
  
  // ネットワーク設定
  network: {
    vpcCidr: string;
    enableNatGateway: boolean;
    availabilityZones: string[];
    createVpcEndpoints: boolean;
    
    // 名前設定
    naming: {
      vpcName: string;
      publicSubnetName: string;
      privateSubnetName: string;
      auroraSecurityGroupName: string;
      lambdaSecurityGroupName: string;
    };
  };
  
  // Aurora設定
  aurora: {
    databaseName: string;
    masterUsername: string;
    minCapacity: number;
    maxCapacity: number;
    enableDataApi: boolean;
    deletionProtection: boolean;
    backupRetentionDays: number;
    enableCloudwatchLogs: boolean;
    enablePerformanceInsights: boolean;
    
    // 名前設定
    naming: {
      clusterName: string;
      subnetGroupName: string;
      masterSecretName: string;
      appUserSecretName: string;
    };
  };
  
  // セキュリティ設定
  security: {
    enableVpcFlowLogs: boolean;
    allowedCidrBlocks: string[];
    enableGuardDuty: boolean;
  };
  
  // 共通タグ
  tags: {
    [key: string]: string;
  };
  
  // コスト管理
  cost: {
    budgetLimitUsd: number;
    enableBudgetAlerts: boolean;
  };
}

// 共通のデフォルト設定
export const commonDefaults = {
  network: {
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
    createVpcEndpoints: false,
    naming: {
      // 基本形（環境名は各configで上書き）
      vpcName: 'cpi-bedrock-vpc',
      publicSubnetName: 'cpi-bedrock-public',
      privateSubnetName: 'cpi-bedrock-private',
      auroraSecurityGroupName: 'cpi-bedrock-aurora-sg',
      lambdaSecurityGroupName: 'cpi-bedrock-lambda-sg',
    },
  },
  aurora: {
    masterUsername: 'bedrockadmin',
    enableDataApi: true,
    enableCloudwatchLogs: true,
    enablePerformanceInsights: false,
    naming: {
      clusterName: 'cpi-bedrock-cluster',
      subnetGroupName: 'cpi-bedrock-subnet-group',
      masterSecretName: 'cpi-bedrock-master-secret',
      appUserSecretName: 'cpi-bedrock-app-secret',
    },
  },
  security: {
    allowedCidrBlocks: ['10.0.0.0/16'],
    enableGuardDuty: false,
  },
  tags: {
    Project: 'bedrock-vector-db',
    ManagedBy: 'cdk',
  },
};