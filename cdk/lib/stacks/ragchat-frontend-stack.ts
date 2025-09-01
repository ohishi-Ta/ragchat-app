// lib/stacks/ragchat-frontend-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';
import { CloudFrontConstruct } from '../constructs/cloudfront-construct';
import { FrontendDeployConstruct } from '../constructs/frontend-deploy-construct';

export interface RagchatFrontendStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class RagchatFrontendStack extends cdk.Stack {
  public readonly frontBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: RagchatFrontendStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Service Stackからの出力値を参照
    const cognitoUserPoolId = cdk.Fn.importValue(`${config.environment}-RagchatService-CognitoUserPoolId`);
    const cognitoUserPoolClientId = cdk.Fn.importValue(`${config.environment}-RagchatService-CognitoUserPoolClientId`);
    const apiGatewayHttpApiUrl = cdk.Fn.importValue(`${config.environment}-RagchatService-ApiGatewayHttpApiUrl`);
    const ragSseStreamFunctionUrl = cdk.Fn.importValue(`${config.environment}-RagchatService-RagSseStreamFunctionUrl`);
    const ragGenerateImageFunctionUrl = cdk.Fn.importValue(`${config.environment}-RagchatService-RagGenerateImageFunctionUrl`);

    // 1. Frontend S3 Bucket
    this.frontBucket = new s3.Bucket(this, 'FrontBucket', {
      bucketName: config.s3.frontBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
      
      lifecycleRules: [{
        id: 'DeleteIncompleteMultipartUploads',
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
      }],

      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // 2. CloudFront Distribution
    const cloudFrontConstruct = new CloudFrontConstruct(this, 'CloudFront', {
      config,
      frontBucket: this.frontBucket,
      domainName: config.domain?.domainName,
      certificateArn: config.domain?.certificateArn,
    });

    this.distribution = cloudFrontConstruct.distribution;

    // 3. Frontend Deploy (NodejsBuild使用)
    const frontendDeployConstruct = new FrontendDeployConstruct(this, 'FrontendDeploy', {
      config,
      frontBucket: this.frontBucket,
      distribution: this.distribution,
      serviceStackOutputs: {
        cognitoUserPoolId,
        cognitoUserPoolClientId,
        apiGatewayHttpApiUrl,
        ragSseStreamFunctionUrl,
        ragGenerateImageFunctionUrl,
      },
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      description: 'Frontend S3 Bucket Name',
      value: this.frontBucket.bucketName,
      exportName: `${this.stackName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      description: 'CloudFront Distribution ID',
      value: this.distribution.distributionId,
      exportName: `${this.stackName}-CloudFrontDistributionId`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionUrl', {
      description: 'CloudFront Distribution URL',
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `${this.stackName}-CloudFrontDistributionUrl`,
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