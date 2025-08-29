// lib/constructs/cloudfront-construct.ts

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface CloudFrontConstructProps {
  config: EnvironmentConfig;
  frontBucket: s3.Bucket;
  domainName?: string;
  certificateArn?: string;
}

export class CloudFrontConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly originAccessControl: cloudfront.S3OriginAccessControl;

  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    const { config, frontBucket, domainName, certificateArn } = props;

    // CloudFront OAC - 設定から命名取得
    this.originAccessControl = new cloudfront.S3OriginAccessControl(this, 'RagFrontOAC', {
      originAccessControlName: config.cloudfront.originAccessControlName,
    });

    // Certificate configuration
    const certificate = domainName && certificateArn 
      ? certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)
      : undefined;

    // CloudFront Distribution props - 設定から命名取得
    const distributionProps: cloudfront.DistributionProps = {
      comment: config.cloudfront.distributionName,
      defaultRootObject: 'index.html',
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(frontBucket, {
          originAccessControl: this.originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      // Domain configuration - 初期化時に条件で設定
      ...(domainName && certificate ? {
        domainNames: [domainName],
        certificate: certificate,
      } : {}),
    };

    this.distribution = new cloudfront.Distribution(this, 'RagDistribution', distributionProps);

    // S3 Bucket Policy for CloudFront
    frontBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontServicePrincipal',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [`${frontBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
        },
      },
    }));

    // タグ設定
    this.applyTags(config.tags);
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}