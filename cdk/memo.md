# CDKプロジェクト推奨構造

```
cpi-bedrock-infrastructure/
├── lib/
│   ├── constructs/                   # 再利用可能コンポーネント
│   │   ├── network-construct.ts     # VPC、サブネット等
│   │   ├── aurora-construct.ts      # Aurora Serverless v2
│   │   └── security-construct.ts    # セキュリティグループ、IAM
│   ├── stacks/                      # スタック定義
│   │   ├── network-stack.ts         # ネットワーク基盤
│   │   └── database-stack.ts        # Aurora + 関連リソース
│   ├── config/                      # 環境設定
│   │   ├── environment-config.ts    # 環境別設定型定義
│   │   ├── dev-config.ts           # 開発環境設定
│   │   └── prod-config.ts          # 本番環境設定
│   └── cpi-ai-iac-stack.ts         # メインスタック（既存）
├── bin/
│   └── cpi-ai-iac.ts              # エントリーポイント（既存）
├── test/                           # テストファイル
├── scripts/
│   └── db-init.sql                 # データベース初期化SQL
├── package.json
├── cdk.json
├── tsconfig.json
└── README.md
```

## ファイル作成順序

### Phase 1: 基盤設定
1. `lib/config/environment-config.ts` - 型定義
2. `lib/config/dev-config.ts` - 開発環境設定

### Phase 2: ネットワーク構築
3. `lib/constructs/network-construct.ts` - VPC構築
4. `lib/stacks/network-stack.ts` - ネットワークスタック

### Phase 3: データベース構築
5. `lib/constructs/security-construct.ts` - セキュリティグループ
6. `lib/constructs/aurora-construct.ts` - Aurora設定
7. `lib/stacks/database-stack.ts` - データベーススタック

### Phase 4: 統合
8. `bin/cpi-bedrock-infrastructure.ts` - エントリーポイント更新