// lib/constructs/aurora-construct.ts

import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';

export interface AuroraConstructProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  config: EnvironmentConfig;
}

export class AuroraConstruct extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly masterSecret: secretsmanager.ISecret;
  public readonly appUserSecret: secretsmanager.Secret;
  public readonly subnetGroup: rds.SubnetGroup;

  constructor(scope: Construct, id: string, props: AuroraConstructProps) {
    super(scope, id);

    const { vpc, securityGroup, config } = props;

    // サブネットグループ作成
    this.subnetGroup = new rds.SubnetGroup(this, config.aurora.naming.subnetGroupName, {
      description: 'Aurora Serverless v2 subnet group',
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // マスターユーザー用シークレット
    const masterSecret = new secretsmanager.Secret(this, config.aurora.naming.masterSecretName, {
      description: 'Aurora master user credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ 
          username: config.aurora.masterUsername 
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@\\\'/',
        passwordLength: 32,
      },
    });

    this.masterSecret = masterSecret;

    // Auroraクラスター作成
    this.cluster = new rds.DatabaseCluster(this, config.aurora.naming.clusterName, {
      // エンジン設定
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),

      // 認証情報
      credentials: rds.Credentials.fromSecret(masterSecret),
      
      // デフォルトデータベース
      defaultDatabaseName: config.aurora.databaseName,

      // ネットワーク設定
      vpc: vpc,
      securityGroups: [securityGroup],
      subnetGroup: this.subnetGroup,

      // Serverless v2設定
      serverlessV2MinCapacity: config.aurora.minCapacity,
      serverlessV2MaxCapacity: config.aurora.maxCapacity,

      // インスタンス設定
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
        enablePerformanceInsights: config.aurora.enablePerformanceInsights,
      }),

      // データAPI有効化
      enableDataApi: config.aurora.enableDataApi,

      // バックアップ設定
      backup: {
        retention: Duration.days(config.aurora.backupRetentionDays),
        preferredWindow: '03:00-04:00', // JST 12:00-13:00
      },

      // メンテナンス設定
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00', // JST日曜13:00-14:00

      // CloudWatchログ
      cloudwatchLogsExports: config.aurora.enableCloudwatchLogs 
        ? ['postgresql'] 
        : undefined,

      // 削除保護
      deletionProtection: config.aurora.deletionProtection,

      // 削除時の動作（開発環境では自動削除）
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.SNAPSHOT,
    });

    // アプリケーション用ユーザーのシークレット
    this.appUserSecret = new secretsmanager.Secret(this, config.aurora.naming.appUserSecretName, {
      description: 'Aurora application user credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ 
          username: 'bedrock_user' 
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@\\\'/',
        passwordLength: 32,
      },
    });

    // カスタムタグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      this.cluster.node.addMetadata(key, value);
    });
  }
}