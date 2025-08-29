// lib/constructs/network-construct.ts

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface NetworkConstructProps {
  config: EnvironmentConfig;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly auroraSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    const { config } = props;

    // VPC作成（物理名の指定なし）
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(config.network.vpcCidr),
      availabilityZones: config.network.availabilityZones,
      restrictDefaultSecurityGroup: true,
      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PrivateIsolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      
      natGateways: 0,
    });

    // VPCにタグを追加（識別用）
    cdk.Tags.of(this.vpc).add('Name', `${config.environment}-vpc`);

    // Aurora用セキュリティグループ（物理名の指定なし）
    this.auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora Serverless v2',
      allowAllOutbound: true,
    });

    // Auroraセキュリティグループにタグを追加
    cdk.Tags.of(this.auroraSecurityGroup).add('Name', `${config.environment}-aurora-sg`);

    // 自分自身からのアクセスを許可
    this.auroraSecurityGroup.addIngressRule(
      this.auroraSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow access from same security group'
    );

    // Lambda用セキュリティグループ（物理名の指定なし）
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Lambdaセキュリティグループにタグを追加
    cdk.Tags.of(this.lambdaSecurityGroup).add('Name', `${config.environment}-lambda-sg`);

    // Lambda → Aurora接続許可
    this.auroraSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow access from Lambda'
    );

    // S3 VPCエンドポイント
    this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    
    // // Secrets Manager VPCエンドポイント
    const secretsManagerEndpoint = this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });

    // Secrets Manager VPCエンドポイントにタグを追加
    cdk.Tags.of(secretsManagerEndpoint).add('Name', `${config.environment}-SecretsManagerEndpoint`);

    // RdsDataEndpoint VPCエンドポイント
    const rdsDataEndpoint = this.vpc.addInterfaceEndpoint('RdsDataEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.RDS_DATA,
      privateDnsEnabled: true,
    });

    // RdsDataEndpoint VPCエンドポイントにタグを追加
    cdk.Tags.of(rdsDataEndpoint).add('Name', `${config.environment}-RdsDataEndpoint`);
  }
}