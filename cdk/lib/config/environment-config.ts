// lib/config/environment-config.ts

export type Environment = 'dev' | 'stg' | 'prod';

export interface EnvironmentConfig {
  environment: Environment;
  
  // ドメイン設定
  domain?: {
    domainName: string;
    certificateArn: string;
  };
  
  // ネットワーク設定
  network: {
    vpcCidr: string;
    enableNatGateway: boolean;
    availabilityZones: string[];
    createVpcEndpoints: boolean;
    
    naming: {
      vpcName: string;
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
    
    naming: {
      clusterName: string;
      subnetGroupName: string;
      masterSecretName: string;
    };
  };
  
  // セキュリティ設定
  security: {
    enableVpcFlowLogs: boolean;
    allowedCidrBlocks: string[];
    enableGuardDuty: boolean;
  };

  // CORS
  cors: {
  allowedOrigins: string[];
  };

  // Bedrock設定
  bedrock: {
    knowledgeBaseName: string;
    dataSourceName: string;
    s3BucketName: string;
    embeddingModel: string;
    modelRegion: string;
    imageGenerationRegion: string;
    chunkingStrategy: {
      type: 'HIERARCHICAL';
      maxParentTokens: number;
      maxChildTokens: number;
      overlapTokens: number;
    };
  };
  
  // DynamoDB設定
  dynamodb: {
    tableName: string;
  };
  
  // S3設定
  s3: {
    promptImagesBucketName: string;
    frontBucketName: string;
  };
  
  // Cognito設定
  cognito: {
    userPoolName: string;
    userPoolClientName: string;
  };
  
  // CloudFront設定
  cloudfront: {
    distributionName: string;
    originAccessControlName: string;
  };
  
  // API Gateway設定
  apiGateway: {
    httpApiName: string;
  };

  // EventBridge設定
  eventbridge: {
    eventRuleName: string;
  };

  // CloudTrail証跡設定
  cloudtrail: {
    trailName: string,
    trailBucketName: string,
  },
  
  // CodeBuild設定（新規追加）
  codebuild: {
    projectName: string;
    sourceBucketName: string;
    serviceRoleName: string;
    environmentType: string;
    computeType: string;
    buildTimeout: number;
  };
  
  // CDK出力キー名（新規追加）
  outputs: {
    apiGatewayHttpApiUrl: string;
    cognitoUserPoolId: string;
    cognitoUserPoolClientId: string;
    ragSseStreamFunctionUrl: string;
    ragGenerateImageFunctionUrl: string;
    frontBucketName: string;
    cloudFrontDistributionId: string;
    customDomainUrl?: string;
  };
  
  // Lambda Functions設定
  lambda: {
    ragPromptImagesFunctionName: string;
    s3ImagesFunctionName: string;
    cognitoPostConfirmationFunctionName: string;
    cognitoUserEnableFunctionName: string;
    ragGenerateImageFunctionName: string;
    ragGetChatsFunctionName: string;
    searchChatsFunctionName: string;
    ragSseStreamFunctionName: string;
    ragGetChatDetailFunctionName: string;
    // 追加: Cognito Lambda 用の環境変数
    cognitoSendmailFunctionEnv: {
      ADMIN_EMAILS: string;
      SERVICE_URL: string;
      SYSTEM_EMAIL: string;
    };
  };
  
  // 共通タグ
  tags: {
    [key: string]: string;
  };
}

// 環境別のドメイン設定
const domainConfigs: Record<Environment, { domainName: string; certificateArn: string } | undefined> = {
  dev: {
    domainName: 'dev.ai.cpinfo.jp',
    certificateArn: 'arn:aws:acm:us-east-1:794038219704:certificate/7d2d02e3-c835-491a-b616-50b55f738943'
  },
  stg: {
    domainName: 'stg.ai.cpinfo.jp', 
    certificateArn: 'arn:aws:acm:us-east-1:794038219704:certificate/7d2d02e3-c835-491a-b616-50b55f738943'
  },
  prod: {
    domainName: 'ai.cpinfo.jp',
    certificateArn: 'arn:aws:acm:us-east-1:794038219704:certificate/7d2d02e3-c835-491a-b616-50b55f738943'
  }
};

/**
 * 環境別の設定を生成する関数
 * @param environment - 環境名 ('dev' | 'stg' | 'prod')
 * @returns 環境別の設定オブジェクト
 */
export function createConfig(environment: Environment): EnvironmentConfig {
  
  return {
    environment: environment,
    
    // ドメイン設定
    domain: domainConfigs[environment],

    // VPC
    network: {
      vpcCidr: '10.0.0.0/16',
      enableNatGateway: false,
      availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
      createVpcEndpoints: true,
      
      naming: {
        vpcName: `${environment}-ragchat-vpc`,
        privateSubnetName: `${environment}-ragchat-private-subnet`,
        auroraSecurityGroupName: `${environment}-ragchat-aurora-sg`,
        lambdaSecurityGroupName: `${environment}-ragchat-lambda-sg`,
      },
    },
    
    // DB
    aurora: {
      databaseName: `${environment}_ragchat_db`,
      masterUsername: 'bedrockadmin',
      minCapacity: 0.5,
      maxCapacity: 16,
      enableDataApi: true,
      deletionProtection: false,
      backupRetentionDays: 7,
      enableCloudwatchLogs: true,
      enablePerformanceInsights: false,
      
      naming: {
        clusterName: `${environment}-ragchat-aurora-cluster`,
        subnetGroupName: `${environment}-ragchat-db-subnet-group`,
        masterSecretName: `${environment}-ragchat-aurora-secret`,
      },
    },

    // SG
    security: {
      enableVpcFlowLogs: false,
      allowedCidrBlocks: ['10.0.0.0/16'],
      enableGuardDuty: false,
    },

    // CORS設定
    cors: {
      allowedOrigins: getCorsOrigins(environment),
    },

    // Bedrock
    bedrock: {
      knowledgeBaseName: `${environment}-ragchat-knowledge-base`,
      dataSourceName: `${environment}-ragchat-datasource`,
      s3BucketName: `${environment}-ragchat-kb-source`,
      embeddingModel: 'amazon.titan-embed-text-v2:0',
      modelRegion: 'us-west-2',
      imageGenerationRegion: 'us-east-1',
      chunkingStrategy: {
        type: 'HIERARCHICAL' as const,
        maxParentTokens: 3000,
        maxChildTokens: 1000,
        overlapTokens: 60,
      },
    },

    // DynamoDB設定
    dynamodb: {
      tableName: `${environment}-ragchat-app-table`,
    },
    
    // S3設定
    s3: {
      promptImagesBucketName: `${environment}-ragchat-prompt-images`,
      frontBucketName: `${environment}-ragchat-front`,
    },
    
    // Cognito設定
    cognito: {
      userPoolName: `${environment}-ragchat-user-pool`,
      userPoolClientName: `${environment}-ragchat-user-pool-client`,
    },
    
    // CloudFront設定
    cloudfront: {
      distributionName: `${environment}-ragchat distribution`,
      originAccessControlName: `${environment}-ragchat-OAC`,
    },
    
    // API Gateway設定
    apiGateway: {
      httpApiName: `${environment}-ragchat-http-api`,
    },
    
    // EventBridge設定
    eventbridge: {
      eventRuleName: `${environment}-ragchat-user-enable-rule`,
    },
    
    // CloudTrail証跡設定
    cloudtrail: {
      trailName: `${environment}-ragchat-cognito-user-enable-events`,
      trailBucketName: `${environment}-ragchat-cloudtrail-cognito-logs`,
    },
    
    // CodeBuild設定（新規追加）
    codebuild: {
      projectName: `${environment}-ragchat-frontend-build`,
      sourceBucketName: `${environment}-ragchat-codebuild-source`,
      serviceRoleName: `${environment}-ragchat-codebuild-role`,
      environmentType: 'LINUX_CONTAINER',
      computeType: 'BUILD_GENERAL1_MEDIUM',
      buildTimeout: 60,
    },
    
    // CDK出力キー名（新規追加）
    outputs: {
      apiGatewayHttpApiUrl: 'ApiGatewayHttpApiUrl',
      cognitoUserPoolId: 'CognitoUserPoolId',
      cognitoUserPoolClientId: 'CognitoUserPoolClientId',
      ragSseStreamFunctionUrl: 'RagSseStreamFunctionUrl',
      ragGenerateImageFunctionUrl: 'RagGenerateImageFunctionUrl',
      frontBucketName: 'FrontBucketName',
      cloudFrontDistributionId: 'CloudFrontDistributionId',
      ...(domainConfigs[environment] ? { customDomainUrl: 'CustomDomainUrl' } : {}),
    },
    
    // Lambda Functions設定
    lambda: {
      ragPromptImagesFunctionName: `${environment}-ragchat-prompt-images-function`,
      s3ImagesFunctionName: `${environment}-ragchat-s3-images-function`,
      cognitoPostConfirmationFunctionName: `${environment}-ragchat-cognito-post-confirmation-function`,
      cognitoUserEnableFunctionName: `${environment}-ragchat-cognito-user-enable-function`,
      ragGenerateImageFunctionName: `${environment}-ragchat-generate-image-function`,
      ragGetChatsFunctionName: `${environment}-ragchat-get-chats-function`,
      searchChatsFunctionName: `${environment}-ragchat-search-chats-function`,
      ragSseStreamFunctionName: `${environment}-ragchat-sse-stream-function`,
      ragGetChatDetailFunctionName: `${environment}-ragchat-get-chat-detail-function`,
      cognitoSendmailFunctionEnv: {
        //承認メール管理者アドレス
        ADMIN_EMAILS: 'oishi.t@cpinfo.jp',
        //システムメール送信アドレス
        SYSTEM_EMAIL: 'system@ai.cpinfo.jp',
        SERVICE_URL: `${domainConfigs[environment]?.domainName}`
      },
    },
    tags: {
      Project: 'ragchat-app',
      ManagedBy: 'cdk',
      Environment: environment,
    },
  };
}


// CORS許可オリジンを環境別に取得
function getCorsOrigins(environment: Environment): string[] {
  const origins: string[] = [];
  
  // 開発環境のみローカル環境を許可
  if (environment === 'dev') {
    origins.push('http://localhost:3000', 'http://localhost:5173');
  }
  
  // 各環境のドメイン
  const domainConfig = domainConfigs[environment];
  if (domainConfig?.domainName) {
    origins.push(`https://${domainConfig.domainName}`);
  }
  
  return origins;
}


/**
 * 環境を検証して取得する関数
 * @param value - 環境名の文字列
 * @returns 検証済みの環境名
 */
export function getValidEnvironment(value: string | undefined): Environment {
  const env = (value || 'dev').toLowerCase();
  
  if (env !== 'dev' && env !== 'stg' && env !== 'prod') {
    throw new Error(`Invalid environment: ${env}. Must be one of: dev, stg, prod`);
  }
  
  return env as Environment;
}