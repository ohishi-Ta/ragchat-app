// lib/stacks/ragchat-common-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import { NetworkConstruct } from '../constructs/network-construct';
import { AuroraConstruct } from '../constructs/aurora-construct';
import { DbInitializerConstruct } from '../constructs/db-initializer-construct';
import { BedrockConstruct } from '../constructs/bedrock-construct';
import { EnvironmentConfig } from '../config/environment-config';

export interface RagchatCommonStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class RagchatCommonStack extends cdk.Stack {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  constructor(scope: Construct, id: string, props: RagchatCommonStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ネットワーク構築
    const networkConstruct = new NetworkConstruct(this, 'Network', {
      config,
    });

    // Aurora構築
    const auroraConstruct = new AuroraConstruct(this, 'Aurora', {
      vpc: networkConstruct.vpc,
      securityGroup: networkConstruct.auroraSecurityGroup,
      config,
    });

    // データベース初期化
    const dbInitializerConstruct = new DbInitializerConstruct(this, 'DbInitializer', {
      vpc: networkConstruct.vpc,
      lambdaSecurityGroup: networkConstruct.lambdaSecurityGroup,
      cluster: auroraConstruct.cluster,
      masterSecret: auroraConstruct.masterSecret,
      config,
    });

    // Bedrock Knowledge Base構築
    const bedrockConstruct = new BedrockConstruct(this, 'Bedrock', {
      cluster: auroraConstruct.cluster,
      masterSecret: auroraConstruct.masterSecret,
      config,
    });

    // Knowledge Baseを公開
    this.knowledgeBase = bedrockConstruct.knowledgeBase;

    // 依存関係を明示的に設定
    bedrockConstruct.node.addDependency(auroraConstruct.cluster);
    bedrockConstruct.node.addDependency(dbInitializerConstruct.customResource);


    // タグ設定
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}