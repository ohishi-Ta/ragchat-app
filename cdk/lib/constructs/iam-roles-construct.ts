// lib/constructs/iam-roles-construct.ts

import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface IamRolesConstructProps {
  config: EnvironmentConfig;
  dynamoTable: dynamodb.Table;
}

export class IamRolesConstruct extends Construct {
  public readonly lambdaGenerateRole: iam.Role;
  public readonly lambdaGetChatRole: iam.Role;
  public readonly lambdaPromptImagesRole: iam.Role;
  public readonly lambdaS3ImagesRole: iam.Role;
  public readonly lambdaCognitoSESRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamRolesConstructProps) {
    super(scope, id);

    const { config, dynamoTable } = props;

    this.lambdaGenerateRole = this.createLambdaGenerateRole(dynamoTable);
    this.lambdaGetChatRole = this.createLambdaGetChatRole(dynamoTable);
    this.lambdaPromptImagesRole = this.createLambdaPromptImagesRole();
    this.lambdaS3ImagesRole = this.createLambdaS3ImagesRole(dynamoTable);
    this.lambdaCognitoSESRole = this.createLambdaCognitoSESRoleBase();

    // タグ設定
    this.applyTags(config.tags);
  }

  private createLambdaGenerateRole(dynamoTable: dynamodb.Table): iam.Role {
    const lambdaGeneratePolicy = new iam.ManagedPolicy(this, 'LambdaGeneratePolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
          resources: [dynamoTable.tableArn],
        }),
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeModelWithResponseStream', 'bedrock:GetInferenceProfile', 'bedrock:InvokeModel'],
          resources: [
            'arn:aws:bedrock:us-west-2:794038219704:inference-profile/us.amazon.nova-lite-v1:0',
            'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
            'arn:aws:bedrock:us-west-2:794038219704:inference-profile/us.amazon.nova-pro-v1:0',
            'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
            'arn:aws:bedrock:us-west-2:794038219704:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0',
            'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0',
            'arn:aws:bedrock:us-west-2:794038219704:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0',
            'arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0',
            'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-canvas-v1:0',
            'arn:aws:bedrock:us-west-2::foundation-model/openai.gpt-oss-20b-1:0',
            'arn:aws:bedrock:us-west-2::foundation-model/openai.gpt-oss-120b-1:0',
          ],
        }),
        new iam.PolicyStatement({
          actions: ['bedrock:Retrieve', 'bedrock:RetrieveAndGenerate'],
          resources: [
            'arn:aws:bedrock:ap-northeast-1:794038219704:knowledge-base/*',
            'arn:aws:bedrock:ap-northeast-1:794038219704:knowledge-base/*/*',
          ],
        }),
        new iam.PolicyStatement({
          actions: ['bedrock:GetKnowledgeBase', 'bedrock:ListKnowledgeBases'],
          resources: ['*'],
        }),
      ],
    });

    return new iam.Role(this, 'LambdaGenerateRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        lambdaGeneratePolicy,
      ],
    });
  }

  private createLambdaGetChatRole(dynamoTable: dynamodb.Table): iam.Role {
    const lambdaGetChatPolicy = new iam.ManagedPolicy(this, 'LambdaGetChatPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    return new iam.Role(this, 'LambdaGetChatRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        lambdaGetChatPolicy,
      ],
    });
  }

  private createLambdaPromptImagesRole(): iam.Role {
    return new iam.Role(this, 'LambdaPromptImagesRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    });
  }

  private createLambdaS3ImagesRole(dynamoTable: dynamodb.Table): iam.Role {
    const lambdaS3ImagesPolicy = new iam.ManagedPolicy(this, 'LambdaS3ImagesPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    return new iam.Role(this, 'LambdaS3ImagesRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        lambdaS3ImagesPolicy,
      ],
    });
  }

  // Cognito権限を除外したベースロール
  private createLambdaCognitoSESRoleBase(): iam.Role {
    const lambdaCognitoSESPolicy = new iam.ManagedPolicy(this, 'LambdaCognitoSESPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: [`arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/*`],
        }),
        // Cognito権限は削除（後でCognitoPolicyConstructで追加）
      ],
    });

    return new iam.Role(this, 'LambdaCognitoSESRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        lambdaCognitoSESPolicy,
      ],
    });
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}