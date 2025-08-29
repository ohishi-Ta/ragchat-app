// lib/constructs/cloudtrail-construct.ts

import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';

export interface CloudTrailConstructProps {
  config: EnvironmentConfig;
}

export class CloudTrailConstruct extends Construct {
  public readonly trail: cloudtrail.Trail;
  public readonly logsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CloudTrailConstructProps) {
    super(scope, id);

    const { config } = props;

    // CloudTrail ログ用の S3 バケット
    this.logsBucket = new s3.Bucket(this, 'CloudTrailLogsBucket', {
      bucketName: config.cloudtrail.trailBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
      lifecycleRules: [{
        id: 'DeleteOldLogs',
        expiration: cdk.Duration.days(90), // 90日後に削除
      }],
    });

    // CloudTrail - Cognitoイベント専用
    this.trail = new cloudtrail.Trail(this, 'CognitoUserEnableEventsTrail', {
      trailName: config.cloudtrail.trailName,
      bucket: this.logsBucket,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: false, // 単一リージョンでコスト最適化
      enableFileValidation: true,
      
      // 管理イベントのみ（Cognitoの管理アクション）
      managementEvents: cloudtrail.ReadWriteType.ALL,
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