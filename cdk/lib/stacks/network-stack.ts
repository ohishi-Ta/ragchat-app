// lib/stacks/network-stack.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkConstruct } from '../constructs/network-construct';
import { EnvironmentConfig } from '../config/environment-config';

export interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  public readonly networkConstruct: NetworkConstruct;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ネットワーク構築
    this.networkConstruct = new NetworkConstruct(this, 'Network', {
      config,
    });

    // スタックレベルでの出力値
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.networkConstruct.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${config.environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'AuroraSecurityGroupId', {
      value: this.networkConstruct.auroraSecurityGroup.securityGroupId,
      description: 'Aurora Security Group ID',
      exportName: `${config.environment}-aurora-sg-id`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.networkConstruct.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID', 
      exportName: `${config.environment}-lambda-sg-id`,
    });

    // プライベートサブネットID一覧
    const allPrivateSubnets = [
      ...this.networkConstruct.vpc.privateSubnets,
      ...this.networkConstruct.vpc.isolatedSubnets,
    ];
    
    if (allPrivateSubnets.length > 0) {
      new cdk.CfnOutput(this, 'PrivateSubnetIds', {
        value: allPrivateSubnets.map(subnet => subnet.subnetId).join(','),
        description: 'Private Subnet IDs',
        exportName: `${config.environment}-private-subnet-ids`,
      });
    }

    // パブリックサブネットID一覧
    if (this.networkConstruct.vpc.publicSubnets.length > 0) {
      new cdk.CfnOutput(this, 'PublicSubnetIds', {
        value: this.networkConstruct.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
        description: 'Public Subnet IDs',
        exportName: `${config.environment}-public-subnet-ids`,
      });
    }

    // 共通タグ設定
    this.applyCommonTags(config.tags);
  }

  private applyCommonTags(tags: { [key: string]: string }): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}