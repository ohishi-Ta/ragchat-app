// lib/constructs/bedrock-construct.ts

import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';

export interface BedrockConstructProps {
  cluster: rds.DatabaseCluster;
  masterSecret: secretsmanager.ISecret;
  config: EnvironmentConfig;
}

export class BedrockConstruct extends Construct {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly dataSource: bedrock.CfnDataSource;
  public readonly s3Bucket: s3.Bucket;
  public readonly serviceRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockConstructProps) {
    super(scope, id);

    const { cluster, masterSecret, config } = props;

    // S3バケット作成（存在確認は実際の運用で行う）
    this.s3Bucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: config.bedrock.s3BucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
    });

    // 1. Bedrock Knowledge Base用 Customer Managed Policy を作成
    const bedrockKnowledgeBasePolicy = new iam.ManagedPolicy(this, 'KnowledgeBasePolicy', {
    statements: [
        // S3アクセス権限
        new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            's3:GetObject',
            's3:ListBucket',
            's3:GetBucketLocation',
        ],
        resources: [
            this.s3Bucket.bucketArn,
            `${this.s3Bucket.bucketArn}/*`,
        ],
        }),
        // RDS権限
        new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rds:DescribeDBClusters'],
        resources: ['*'], // 必要なら特定クラスターに絞る
        }),
        new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'rds-data:BatchExecuteStatement',
            'rds-data:ExecuteStatement',
        ],
        resources: [cluster.clusterArn],
        }),
        // Secrets Manager権限
        new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
        ],
        resources: [masterSecret.secretArn],
        }),
        // Bedrock権限
        new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
            `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${config.bedrock.embeddingModel}`,
        ],
        }),
    ],
    });

    // 2. ロール作成時に Customer Managed Policy をアタッチ
    this.serviceRole = new iam.Role(this, 'KnowledgeBaseRole', {
    assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com', {
        conditions: {
        StringEquals: {
            'aws:SourceAccount': cdk.Stack.of(this).account,
        },
        ArnLike: {
            'aws:SourceArn': [
            `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:knowledge-base/*`,
            ],
        },
        },
    }),
    managedPolicies: [bedrockKnowledgeBasePolicy], // ←ここでアタッチ
    });

    // Bedrock Knowledge Base作成
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: config.bedrock.knowledgeBaseName,
      description: `Knowledge base for ${config.environment} environment`,
      roleArn: this.serviceRole.roleArn,
      
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${process.env.CDK_DEFAULT_REGION}::foundation-model/${config.bedrock.embeddingModel}`,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 1024,
            },
          },
        },
      },

      storageConfiguration: {
        type: 'RDS',
        rdsConfiguration: {
          resourceArn: cluster.clusterArn,
          credentialsSecretArn: masterSecret.secretArn,
          databaseName: config.aurora.databaseName,
          tableName: 'bedrock_integration.bedrock_knowledge_base',
          fieldMapping: {
            primaryKeyField: 'id',
            vectorField: 'embedding',
            textField: 'chunks',
            metadataField: 'metadata',
          },
        },
      },

      tags: config.tags,
    });

    // データソース作成
    this.dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
      name: config.bedrock.dataSourceName,
      description: `Data source for ${config.environment} knowledge base`,
      knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
      
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.s3Bucket.bucketArn
        },
      },

      dataDeletionPolicy: 'DELETE',

      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: config.bedrock.chunkingStrategy.type,
          hierarchicalChunkingConfiguration: {
            levelConfigurations: [
              {
                maxTokens: config.bedrock.chunkingStrategy.maxParentTokens,
              },
              {
                maxTokens: config.bedrock.chunkingStrategy.maxChildTokens,
              },
            ],
            overlapTokens: config.bedrock.chunkingStrategy.overlapTokens,
          },
        },
      },
    });

    // Knowledge Baseが作成された後にData Sourceを作成
    this.dataSource.addDependency(this.knowledgeBase);

    // カスタムタグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      this.knowledgeBase.node.addMetadata(key, value);
      this.dataSource.node.addMetadata(key, value);
      this.s3Bucket.node.addMetadata(key, value);
    });
  }
}