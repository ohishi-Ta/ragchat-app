// lib/stacks/ragchat-service-stack.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';
import { CognitoConstruct } from '../constructs/cognito-construct';
import { StorageConstruct } from '../constructs/storage-construct';
import { CloudFrontConstruct } from '../constructs/cloudfront-construct';
import { IamRolesConstruct } from '../constructs/iam-roles-construct';
import { LambdaConstruct } from '../constructs/lambda-construct';
import { ApiGatewayConstruct } from '../constructs/api-gateway-construct';
import { EventBridgeConstruct } from '../constructs/eventbridge-construct';
import { CloudTrailConstruct } from '../constructs/cloudtrail-construct';
import { CognitoPolicyConstruct } from '../constructs/cognito-policy-construct'; // 🆕

export interface RagchatServiceStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  knowledgeBaseId?: string;
  knowledgeBaseRegion?: string;
}

export class RagchatServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RagchatServiceStackProps) {
    super(scope, id, props);

    const { config, knowledgeBaseId, knowledgeBaseRegion } = props;

    // 1. Storage
    const storageConstruct = new StorageConstruct(this, 'Storage', { config });

    // 2. IAM Roles（ベース版、Cognito権限なし）
    const iamRolesConstruct = new IamRolesConstruct(this, 'IamRoles', {
      config,
      dynamoTable: storageConstruct.dynamoTable,
      // 注意: userPool パラメータを削除
    });

    // 3. CloudFront
    const cloudFrontConstruct = new CloudFrontConstruct(this, 'CloudFront', {
      config,
      frontBucket: storageConstruct.frontBucket,
      domainName: config.domain?.domainName,
      certificateArn: config.domain?.certificateArn,
    });

    // 4. Lambda Functions
    const lambdaConstruct = new LambdaConstruct(this, 'Lambda', {
      config,
      knowledgeBaseId: knowledgeBaseId,
      knowledgeBaseRegion: knowledgeBaseRegion,
      dynamoTable: storageConstruct.dynamoTable,
      promptImagesBucket: storageConstruct.promptImagesBucket,
      roles: {
        lambdaGenerateRole: iamRolesConstruct.lambdaGenerateRole,
        lambdaGetChatRole: iamRolesConstruct.lambdaGetChatRole,
        lambdaPromptImagesRole: iamRolesConstruct.lambdaPromptImagesRole,
        lambdaS3ImagesRole: iamRolesConstruct.lambdaS3ImagesRole,
        lambdaCognitoSESRole: iamRolesConstruct.lambdaCognitoSESRole,
      },
    });

    // 5. Cognito（Lambdaトリガー付き）
    const cognitoConstruct = new CognitoConstruct(this, 'Cognito', {
      config,
      lambdaPostConfirmation: lambdaConstruct.cognitoPostConfirmationFunction,
      lambdaUserEnable: lambdaConstruct.cognitoUserEnableFunction,
    });

    // 6. 🆕 Cognito Policy（具体的ARN使用してベースロールに権限追加）
    const cognitoPolicyConstruct = new CognitoPolicyConstruct(this, 'CognitoPolicy', {
      config,
      userPool: cognitoConstruct.userPool,
      lambdaCognitoSESRole: iamRolesConstruct.lambdaCognitoSESRole,
    });

    // 依存関係を明示的に設定
    cognitoPolicyConstruct.node.addDependency(cognitoConstruct);

    // 7. API Gateway
    const apiGatewayConstruct = new ApiGatewayConstruct(this, 'ApiGateway', {
      config,
      userPool: cognitoConstruct.userPool,
      userPoolClient: cognitoConstruct.userPoolClient,
      lambdaFunctions: {
        ragPromptImagesFunction: lambdaConstruct.ragPromptImagesFunction,
        s3ImagesFunction: lambdaConstruct.s3ImagesFunction,
        ragGetChatsFunction: lambdaConstruct.ragGetChatsFunction,
        searchChatsFunction: lambdaConstruct.searchChatsFunction,
        ragGetChatDetailFunction: lambdaConstruct.ragGetChatDetailFunction,
      },
    });

    // 8. CloudTrail（EventBridgeのイベント監視に必要）
    const cloudTrailConstruct = new CloudTrailConstruct(this, 'CloudTrail', {
      config,
    });

    // 9. EventBridge - Cognito AdminEnableUser イベントを監視
    const eventBridgeConstruct = new EventBridgeConstruct(this, 'EventBridge', {
      config,
      userPool: cognitoConstruct.userPool,
      targetLambdaFunction: lambdaConstruct.cognitoUserEnableFunction,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      description: 'Cognito User Pool ID',
      value: cognitoConstruct.userPool.userPoolId,
      exportName: `${this.stackName}-CognitoUserPoolId`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
    description: 'Cognito User Pool Client ID',
    value: cognitoConstruct.userPoolClient.userPoolClientId,
    exportName: `${this.stackName}-CognitoUserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayHttpApiUrl', {
      description: 'API Gateway HTTP API base URL',
      value: `${apiGatewayConstruct.httpApi.apiEndpoint}/${config.environment}`,
      exportName: `${this.stackName}-ApiGatewayHttpApiUrl`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionUrl', {
      description: 'CloudFront Distribution URL',
      value: `https://${cloudFrontConstruct.distribution.distributionDomainName}`,
      exportName: `${this.stackName}-CloudFrontDistributionUrl`,
    });

    new cdk.CfnOutput(this, 'RagGenerateImageFunctionUrl', {
      description: 'RAG Generate Image Function URL',
      value: lambdaConstruct.ragGenerateImageFunctionUrl.url,
      exportName: `${this.stackName}-RagGenerateImageFunctionUrl`,
    });

    new cdk.CfnOutput(this, 'RagSseStreamFunctionUrl', {
      description: 'RAG SSE Stream Function URL',
      value: lambdaConstruct.ragSseStreamFunctionUrl.url,
      exportName: `${this.stackName}-RagSseStreamFunctionUrl`,
    });

    if (config.domain) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        description: 'Custom Domain URL',
        value: `https://${config.domain.domainName}`,
        exportName: `${this.stackName}-CustomDomainUrl`,
      });
    }

    // タグ設定
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}