// lib/constructs/network-construct.ts

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment-config';

export interface NetworkConstructProps {
  config: EnvironmentConfig;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly privateSubnets: ec2.ISubnet[];
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly auroraSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    const { config } = props;

    // VPC作成
    this.vpc = new ec2.Vpc(this, config.network.naming.vpcName, {
      ipAddresses: ec2.IpAddresses.cidr(config.network.vpcCidr),
      availabilityZones: config.network.availabilityZones,
      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: config.network.naming.publicSubnetName,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: config.network.naming.privateSubnetName,
          subnetType: config.network.enableNatGateway 
            ? ec2.SubnetType.PRIVATE_WITH_EGRESS 
            : ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      
      // NATゲートウェイの設定
      natGateways: config.network.enableNatGateway ? config.network.availabilityZones.length : 0,
      
      // VPCフローログ
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // サブネット参照
    this.privateSubnets = this.vpc.privateSubnets;
    this.publicSubnets = this.vpc.publicSubnets;

    // Aurora用セキュリティグループ
    this.auroraSecurityGroup = new ec2.SecurityGroup(this, config.network.naming.auroraSecurityGroupName, {
      vpc: this.vpc,
      description: 'Security group for Aurora Serverless v2',
      allowAllOutbound: true,
    });

    // 自分自身からのアクセスを許可（同じセキュリティグループ内）
    this.auroraSecurityGroup.addIngressRule(
      this.auroraSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow access from same security group'
    );

    // Lambda用セキュリティグループ
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, config.network.naming.lambdaSecurityGroupName, {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Lambda → Aurora接続許可
    this.auroraSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow access from Lambda'
    );

    // 開発環境の場合、特定CIDRからの直接アクセスを許可
    if (config.environment === 'dev') {
      config.security.allowedCidrBlocks.forEach((cidr, index) => {
        this.auroraSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(cidr),
          ec2.Port.tcp(5432),
          `Allow dev access from ${cidr}`
        );
      });
    }

    // VPCエンドポイント（オプション）
    if (config.network.createVpcEndpoints) {
      this.createVpcEndpoints();
    }

    // VPCフローログ（オプション）
    if (config.security.enableVpcFlowLogs) {
      this.createVpcFlowLogs();
    }

    // タグ設定
    this.applyTags(config.tags);
  }

  private createVpcEndpoints(): void {
    // S3 VPCエンドポイント
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Secrets Manager VPCエンドポイント
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });
  }

  private createVpcFlowLogs(): void {
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
    });
  }

  private applyTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      this.vpc.node.addMetadata(key, value);
    });
  }
}