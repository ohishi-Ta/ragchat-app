// lib/constructs/cognito-construct.ts

import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';

export interface CognitoConstructProps {
  config: EnvironmentConfig;
  lambdaPostConfirmation?: lambda.IFunction;
  lambdaUserEnable?: lambda.IFunction;
}

export class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

     const { config, lambdaPostConfirmation, lambdaUserEnable } = props;

    // Cognito User Pool - 設定から命名取得
    this.userPool = new cognito.UserPool(this, 'RagAppUserPool', {
      userPoolName: config.cognito.userPoolName,
      // セルフサービスのサインアップを有効化
      selfSignUpEnabled: true,
      // 自動検証設定
      autoVerify: { email: true },
      // 標準属性設定
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      // パスワードポリシー設定
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
        // アカウント復旧設定
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // 削除ポリシー設定
      removalPolicy: config.environment === 'dev' 
        ? RemovalPolicy.DESTROY 
        : RemovalPolicy.RETAIN,
      lambdaTriggers: {
      postConfirmation: lambdaPostConfirmation,
    },
    });

    // Cognito User Pool Client - 設定から命名取得
    this.userPoolClient = new cognito.UserPoolClient(this, 'RagAppUserPoolClient', {
      userPoolClientName: config.cognito.userPoolClientName,
      userPool: this.userPool,
      accessTokenValidity: Duration.days(1),
      idTokenValidity: Duration.days(1),
      refreshTokenValidity: Duration.days(14),
      preventUserExistenceErrors: true,
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