// lib/constructs/eventbridge-construct.ts

import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface EventBridgeConstructProps {
  config: EnvironmentConfig;
  userPool: cognito.UserPool;
  targetLambdaFunction: lambda.Function;
}

export class EventBridgeConstruct extends Construct {
  public readonly eventRule: events.Rule;

  constructor(scope: Construct, id: string, props: EventBridgeConstructProps) {
    super(scope, id);

    const { config, userPool, targetLambdaFunction } = props;

    // EventBridge Rule for Cognito AdminEnableUser events
    this.eventRule = new events.Rule(this, 'CognitoEnableUserEventRule', {
      ruleName: config.eventbridge.eventRuleName,
      description: `Monitor Cognito AdminEnableUser events for ${config.environment} environment`,
      eventPattern: {
        source: ['aws.cognito-idp'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cognito-idp.amazonaws.com'],
          eventName: ['AdminEnableUser'],
          requestParameters: {
            userPoolId: [userPool.userPoolId]
          }
        }
      }
    });

    // ターゲット
    this.eventRule.addTarget(new targets.LambdaFunction(targetLambdaFunction));

    // 削除ポリシー
    this.eventRule.applyRemovalPolicy(
      config.environment === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    );
    
    // タグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}