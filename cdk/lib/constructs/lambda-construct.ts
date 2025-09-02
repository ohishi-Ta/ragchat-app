// lib/constructs/lambda-construct.ts

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { EnvironmentConfig } from '../config/environment-config';
import * as path from 'path';

export interface LambdaConstructProps {
  config: EnvironmentConfig;
  dynamoTable: dynamodb.Table;
  knowledgeBaseId?: string;
  knowledgeBaseRegion?: string;
  promptImagesBucket: s3.Bucket;
  roles: {
    lambdaGenerateRole: iam.Role;
    lambdaGetChatRole: iam.Role;
    lambdaPromptImagesRole: iam.Role;
    lambdaS3ImagesRole: iam.Role;
    lambdaCognitoSESRole: iam.Role;
  };
}

export class LambdaConstruct extends Construct {
  public readonly ragPromptImagesFunction: lambda.Function;
  public readonly s3ImagesFunction: lambda.Function;
  public readonly cognitoPostConfirmationFunction: lambda.Function;
  public readonly cognitoUserEnableFunction: lambda.Function;
  public readonly ragGenerateImageFunction: lambda.Function;
  public readonly ragGetChatsFunction: lambda.Function;
  public readonly searchChatsFunction: lambda.Function;
  public readonly ragSseStreamFunction: lambda.Function;
  public readonly ragGetChatDetailFunction: lambda.Function;

  // Function URLsを保持するプロパティ
  public readonly ragGenerateImageFunctionUrl: lambda.FunctionUrl;
  public readonly ragSseStreamFunctionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const { config, knowledgeBaseId, knowledgeBaseRegion, dynamoTable, promptImagesBucket, roles } = props;

    // 1. Rag Prompt Images Function
    this.ragPromptImagesFunction = new lambda.Function(this, 'RagPromptImagesFunction', {
      functionName: config.lambda.ragPromptImagesFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/rag-prompt-images')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaPromptImagesRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        S3_BUCKET_NAME: promptImagesBucket.bucketName,
      },
    });

    // 2. S3 Images Function
    this.s3ImagesFunction = new lambda.Function(this, 'S3ImagesFunction', {
      functionName: config.lambda.s3ImagesFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/s3-images')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaS3ImagesRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        S3_BUCKET_NAME: promptImagesBucket.bucketName,
      },
    });

    // 3. Cognito Post Confirmation Function
    this.cognitoPostConfirmationFunction = new lambda.Function(this, 'CognitoPostConfirmationFunction', {
      functionName: config.lambda.cognitoPostConfirmationFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/cognito-post-confirmation')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaCognitoSESRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ADMIN_EMAILS: config.lambda.cognitoSendmailFunctionEnv.ADMIN_EMAILS,
        SYSTEM_EMAIL: config.lambda.cognitoSendmailFunctionEnv.SYSTEM_EMAIL,
      },
    });

    // 4. Cognito User Enable Function
    this.cognitoUserEnableFunction = new lambda.Function(this, 'CognitoUserEnableFunction', {
      functionName: config.lambda.cognitoUserEnableFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/cognito-user-enable')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaCognitoSESRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        SERVICE_URL: `https://${config.domain?.domainName}`,
        SYSTEM_EMAIL: config.lambda.cognitoSendmailFunctionEnv.SYSTEM_EMAIL,
      },
    });

    // 5. Rag Generate Image Function
    this.ragGenerateImageFunction = new lambda.Function(this, 'RagGenerateImageFunction', {
      functionName: config.lambda.ragGenerateImageFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/rag-generate-image')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaGenerateRole,
      timeout: Duration.seconds(300),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        BEDROCK_GENIMAGE_AWS_REGION : config.bedrock.imageGenerationRegion,
        S3_BUCKET_NAME: promptImagesBucket.bucketName,
      },
    });

    this.ragGenerateImageFunctionUrl = this.ragGenerateImageFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: {
        allowCredentials: false,
        allowedHeaders: ['content-type', 'authorization'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedOrigins: config.cors.allowedOrigins,
      },
    });

    // 6. Rag Get Chats Function
    this.ragGetChatsFunction = new lambda.Function(this, 'RagGetChatsFunction', {
      functionName: config.lambda.ragGetChatsFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/rag-get-chats')),
      handler: 'app.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_13,
      role: roles.lambdaGetChatRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        DYNAMODB_TABLE_NAME: dynamoTable.tableName,
      },
    });

    // 7. Search Chats Function
    this.searchChatsFunction = new lambda.Function(this, 'SearchChatsFunction', {
      functionName: config.lambda.searchChatsFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/search-chats')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaGetChatRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        DYNAMODB_TABLE_NAME: dynamoTable.tableName,
      },
    });

    // 8. Rag SSE Stream Function (with Function URL)
    this.ragSseStreamFunction = new lambda.Function(this, 'RagSseStreamFunction', {
      functionName: config.lambda.ragSseStreamFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/rag-sse-stream')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      role: roles.lambdaGenerateRole,
      timeout: Duration.seconds(300),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        BEDROCK_AWS_REGION: config.bedrock.modelRegion,
        DYNAMODB_TABLE_NAME: dynamoTable.tableName,
        KNOWLEDGE_BASE_ID: knowledgeBaseId || '',
        KB_AWS_REGION: knowledgeBaseRegion || '',
        S3_BUCKET_NAME: promptImagesBucket.bucketName,
      },
    });

    this.ragSseStreamFunctionUrl = this.ragSseStreamFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowCredentials: false,
        allowedHeaders: ['content-type', 'authorization','Cache-Control','Connection'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedOrigins: config.cors.allowedOrigins,
      },
    });

    // 9. Rag Get Chat Detail Function
    this.ragGetChatDetailFunction = new lambda.Function(this, 'RagGetChatDetailFunction', {
      functionName: config.lambda.ragGetChatDetailFunctionName,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/rag-get-chat-detail')),
      handler: 'app.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_13,
      role: roles.lambdaGetChatRole,
      timeout: Duration.seconds(300),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        DYNAMODB_TABLE_NAME: dynamoTable.tableName,
      },
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