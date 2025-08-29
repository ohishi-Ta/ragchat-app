// lib/constructs/cognito-policy-construct.ts

import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface CognitoPolicyConstructProps {
  config: EnvironmentConfig;
  userPool: cognito.UserPool;
  lambdaCognitoSESRole: iam.Role;
}

export class CognitoPolicyConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CognitoPolicyConstructProps) {
    super(scope, id);

    const { config, userPool, lambdaCognitoSESRole } = props;

    // Cognito権限のポリシー作成
    const cognitoPolicy = new iam.Policy(this, 'CognitoSESPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['cognito-idp:AdminDisableUser', 'cognito-idp:AdminGetUser', 'cognito-idp:ListUsers'],
          resources: [userPool.userPoolArn], // 具体的なARN指定
        }),
      ],
    });

    // ベースロールにCognito権限を追加
    lambdaCognitoSESRole.attachInlinePolicy(cognitoPolicy);

    // タグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}