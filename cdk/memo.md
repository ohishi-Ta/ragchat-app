# AWSクレデンシャル設定 
`set AWS_PROFILE=xxxx`

# ビルド
`npm run build`

# デプロイ（dev）
`cdk deploy --all --context environment=dev`

# デプロイ（stg）
`cdk deploy --all --context environment=stg`

# 削除（dev）
`cdk destroy --all --context environment=dev`

# デプロイ（dev-Commonスタック）
`cdk deploy dev-RagchatService --context environment=dev`

# デプロイ（dev-Serviceスタック）
`cdk deploy dev-RagchatService --context environment=dev`

# デプロイ（dev-Frontendスタック）
`cdk deploy dev-RagchatFrontend --context environment=dev`



# デプロイ（stg-Commonスタック）
`cdk deploy stg-RagchatService --context environment=stg`

# デプロイ（stg-Serviceスタック）
`cdk deploy stg-RagchatService --context environment=stg`

# デプロイ（stg-Frontendスタック）
`cdk deploy stg-RagchatFrontend --context environment=stg`

