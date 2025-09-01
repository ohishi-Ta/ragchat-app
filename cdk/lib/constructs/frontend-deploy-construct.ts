// lib/constructs/frontend-deploy-construct.ts

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsBuild } from 'deploy-time-build';
import { EnvironmentConfig } from '../config/environment-config';

export interface FrontendDeployConstructProps {
  config: EnvironmentConfig;
  frontBucket: s3.Bucket;
  distribution: cloudfront.Distribution;
  serviceStackOutputs: {
    cognitoUserPoolId: string;
    cognitoUserPoolClientId: string;
    apiGatewayHttpApiUrl: string;
    ragSseStreamFunctionUrl: string;
    ragGenerateImageFunctionUrl: string;
  };
}

export class FrontendDeployConstruct extends Construct {
  public readonly build: NodejsBuild;

  constructor(scope: Construct, id: string, props: FrontendDeployConstructProps) {
    super(scope, id);

    const { config, frontBucket, distribution, serviceStackOutputs } = props;

    // environment-config.tsのドメイン設定を使用
    const redirectUri = config.domain?.domainName 
      ? `https://${config.domain.domainName}` 
      : 'http://localhost:3000'; // フォールバック用

    // NodejsBuildを使用したフロントエンドの自動ビルド・デプロイ
    this.build = new NodejsBuild(this, 'BuildFrontend', {
      // ソースファイルの設定
      assets: [
        {
          path: '../frontend',
          exclude: [
            '.git/**',
            '.github/**',
            'node_modules/**',
            '**/node_modules/**',
            'cdk/cdk.out/**',
            'cdk/lambda/**',
            '**/*.log',
            'frontend/dist/**',
            '.env*',
            '**/.DS_Store',
            'README.md',
            '.venv/**',
          ],
        },
      ],

      // デプロイ先の設定
      destinationBucket: frontBucket,
      distribution: distribution,
      
      // ビルド設定
      outputSourceDirectory: 'dist',
      buildCommands: [
        'echo "--- Build start ---"',
        'pwd',
        'npm ci',
        `npm run build:${config.environment === 'dev' ? 'developcdk' : 'staging'}`,
        'echo "--- Build end ---"',
      ],

      // 環境変数の設定
      buildEnvironment: {
        NODE_OPTIONS: '--max-old-space-size=4096',
        
        // フロントエンド用環境変数
        VITE_APP_REDIRECT_URI: redirectUri,
        VITE_APP_POST_LOGOUT_REDIRECT_URI: redirectUri,
        VITE_APP_API_BASE_URL: serviceStackOutputs.apiGatewayHttpApiUrl,
        VITE_APP_LAMBDA_FUNCTION_URL: serviceStackOutputs.ragSseStreamFunctionUrl,
        VITE_APP_IMAGE_LAMBDA_FUNCTION_URL: serviceStackOutputs.ragGenerateImageFunctionUrl,
        VITE_APP_USER_POOL_ID: serviceStackOutputs.cognitoUserPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: serviceStackOutputs.cognitoUserPoolClientId,

        // AWS設定
        CDK_DEFAULT_ACCOUNT: cdk.Stack.of(this).account!,
        CDK_DEFAULT_REGION: cdk.Stack.of(this).region,
        ENVIRONMENT: config.environment,
      },
    });

    // タグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}