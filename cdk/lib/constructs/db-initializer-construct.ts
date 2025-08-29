// lib/constructs/db-initializer-construct.ts

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, CustomResource } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';
import * as path from 'path';

export interface DbInitializerConstructProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  cluster: rds.DatabaseCluster;
  masterSecret: secretsmanager.ISecret;
  config: EnvironmentConfig;
}

export class DbInitializerConstruct extends Construct {
  public readonly initializerFunction: lambda.Function;
  public readonly customResource: CustomResource;

  constructor(scope: Construct, id: string, props: DbInitializerConstructProps) {
    super(scope, id);

    const { cluster, masterSecret, config } = props;

    // Python Lambda関数（RDS Data APIを使用、Layerなし、外部ライブラリなし）
    this.initializerFunction = new lambda.Function(this, 'DbInitializer', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/db-initializer')),
      timeout: Duration.minutes(5),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Secrets Managerへのアクセス権限を付与
    masterSecret.grantRead(this.initializerFunction);

    // RDS Data APIへのアクセス権限を付与
    this.initializerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction'
      ],
      resources: [cluster.clusterArn],
    }));

    // Custom Resource Provider
    const provider = new cr.Provider(this, 'DbInitializerProvider', {
      onEventHandler: this.initializerFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Custom Resource
    this.customResource = new CustomResource(this, 'DbInitializerResource', {
      serviceToken: provider.serviceToken,
      properties: {
        ClusterArn: cluster.clusterArn,  // Data API用にARNを渡す
        DatabaseName: config.aurora.databaseName,
        MasterSecretArn: masterSecret.secretArn,
        // タイムスタンプを追加して、更新時に再実行されるようにする
        // Timestamp: new Date().toISOString(),
      },
      // 削除時の動作を設定
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
    });

    // Auroraクラスターの後に実行されるように依存関係を設定
    this.customResource.node.addDependency(cluster);
  }
}