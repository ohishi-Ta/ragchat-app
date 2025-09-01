// lib/constructs/api-gateway-construct.ts

import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface ApiGatewayConstructProps {
  config: EnvironmentConfig;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  lambdaFunctions: {
    ragPromptImagesFunction: lambda.Function;
    s3ImagesFunction: lambda.Function;
    ragGetChatsFunction: lambda.Function;
    searchChatsFunction: lambda.Function;
    ragGetChatDetailFunction: lambda.Function;
  };
}

export class ApiGatewayConstruct extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly stage: apigatewayv2.HttpStage;
  public readonly jwtAuthorizer: apigatewayv2Auth.HttpJwtAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const { config, userPool, userPoolClient, lambdaFunctions } = props;

    // HTTP API Gateway - 設定から命名取得
    this.httpApi = new apigatewayv2.HttpApi(this, 'RagAppHttpApi', {
      apiName: config.apiGateway.httpApiName,
      corsPreflight: {
        allowOrigins: config.cors.allowedOrigins,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
          apigatewayv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: [
          'Authorization',
          `content-type`
        ],
      },
    });
    
   this.stage = new apigatewayv2.HttpStage(this, `${config.environment.charAt(0).toUpperCase() + config.environment.slice(1)}Stage`, {
      httpApi: this.httpApi,
      stageName: config.environment,
      autoDeploy: true,
      description: `${config.environment} stage for RAG Chat API`,
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
    });

    // JWT Authorizer
    this.jwtAuthorizer = new apigatewayv2Auth.HttpJwtAuthorizer('CognitoAuthorizer', 
      `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );

    // API Routes
    this.createRoutes(lambdaFunctions);

    // タグ設定
    this.applyTags(config.tags);
  }

  private createRoutes(lambdaFunctions: {
    ragPromptImagesFunction: lambda.Function;
    s3ImagesFunction: lambda.Function;
    ragGetChatsFunction: lambda.Function;
    searchChatsFunction: lambda.Function;
    ragGetChatDetailFunction: lambda.Function;
  }): void {

    // /presigned-url route
    this.httpApi.addRoutes({
      path: '/presigned-url',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'PresignedUrlIntegration', 
        lambdaFunctions.ragPromptImagesFunction
      ),
      authorizer: this.jwtAuthorizer,
    });

    // /get-image route
    this.httpApi.addRoutes({
      path: '/get-image',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'GetImageIntegration', 
        lambdaFunctions.s3ImagesFunction
      ),
      authorizer: this.jwtAuthorizer,
    });

    // /chats route
    this.httpApi.addRoutes({
      path: '/chats',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'GetChatsIntegration', 
        lambdaFunctions.ragGetChatsFunction
      ),
      authorizer: this.jwtAuthorizer,
    });

    // /search route
    this.httpApi.addRoutes({
      path: '/search',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'SearchIntegration', 
        lambdaFunctions.searchChatsFunction
      ),
      authorizer: this.jwtAuthorizer,
    });

    // /chats/{chatId} route
    this.httpApi.addRoutes({
      path: '/chats/{chatId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'ChatDetailIntegration', 
        lambdaFunctions.ragGetChatDetailFunction
      ),
      authorizer: this.jwtAuthorizer,
    });
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}