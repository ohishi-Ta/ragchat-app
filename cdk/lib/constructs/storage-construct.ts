// lib/constructs/storage-construct.ts

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';

export interface StorageConstructProps {
  config: EnvironmentConfig;
}

export class StorageConstruct extends Construct {
  public readonly dynamoTable: dynamodb.Table;
  public readonly promptImagesBucket: s3.Bucket;
  public readonly frontBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    const { config } = props;

    // DynamoDB Table - 設定から命名取得
    this.dynamoTable = new dynamodb.Table(this, 'RagAppTable', {
      tableName: config.dynamodb.tableName,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
    });

    // S3 Bucket for Prompt Images - 設定から命名取得
    this.promptImagesBucket = new s3.Bucket(this, 'RagPromptImagesBucket', {
      bucketName: config.s3.promptImagesBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [
          s3.HttpMethods.GET,
          s3.HttpMethods.PUT,
          s3.HttpMethods.POST,
          s3.HttpMethods.DELETE,
          s3.HttpMethods.HEAD,
        ],
        allowedOrigins: config.cors.allowedOrigins,
        exposedHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
        maxAge: 3000,
      }],
      lifecycleRules: [{
        id: 'delete-old-uploads',
        enabled: true,
        prefix: 'uploads/',
        expiration: cdk.Duration.days(30),
      }],
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.environment === 'dev',
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