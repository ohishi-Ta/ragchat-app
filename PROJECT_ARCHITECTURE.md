# RAGChat アプリケーション アーキテクチャ詳細

## 目次
1. [システム全体構成](#システム全体構成)
2. [認証フロー](#認証フロー)
3. [チャット機能の通信フロー](#チャット機能の通信フロー)
4. [ファイルアップロード機能](#ファイルアップロード機能)
5. [API エンドポイント一覧](#api-エンドポイント一覧)
6. [データフロー詳細](#データフロー詳細)

---

## システム全体構成

### フロントエンド
- **フレームワーク**: React + TypeScript + Vite
- **状態管理**: Zustand
- **認証**: AWS Amplify (Cognito)
- **UIライブラリ**: Tailwind CSS + Radix UI

### バックエンド (AWS)
- **API Gateway**: HTTP API (JWT認証)
- **Lambda Functions**: Node.js 22.x / Python 3.13
- **認証**: Amazon Cognito
- **データベース**: DynamoDB (チャット履歴)
- **AI/ML**: Amazon Bedrock (Claude, Nova等)
- **ナレッジベース**: Bedrock Knowledge Base + Aurora PostgreSQL
- **ストレージ**: S3 (画像・PDF保存)
- **CDN**: CloudFront

---

## 認証フロー

### 1. ユーザー登録フロー
```
[フロントエンド]
    ↓ 1. サインアップ情報入力
[Amplify Auth]
    ↓ 2. Cognito User Pool にユーザー作成
[Cognito]
    ↓ 3. 確認コード送信（メール）
    ↓ 4. Post Confirmation Lambda トリガー
[Lambda: cognito-post-confirmation]
    ↓ 5. 管理者へ承認依頼メール送信 (SES)
[管理者]
    ↓ 6. 承認リンククリック
[Lambda: cognito-user-enable]
    ↓ 7. ユーザーアカウント有効化
[ユーザー]
    ↓ 8. ログイン可能に
```

### 2. ログインフロー
```
[フロントエンド]
    ↓ 1. ユーザー名/パスワード入力
[Amplify Auth]
    ↓ 2. Cognito認証
[Cognito]
    ↓ 3. JWTトークン発行 (IdToken, AccessToken, RefreshToken)
[フロントエンド]
    ↓ 4. トークンをローカルストレージに保存
    ↓ 5. APIリクエストヘッダーに付与
```

---

## チャット機能の通信フロー

### 1. 通常のチャット（テキストのみ）

#### リクエストフロー
```
[フロントエンド: ChatContainer]
    ↓ 1. メッセージ入力
    ↓ 2. chatApi.sendMessage() 呼び出し
    ↓ 3. fetch('POST /chat/stream')
[API Gateway]
    ↓ 4. JWT認証
    ↓ 5. Lambda Function URLへプロキシ
[Lambda: rag-sse-stream]
    ↓ 6. ユーザーID抽出（JWTから）
    ↓ 7. DynamoDB履歴取得
    ↓ 8. モード判定（general/knowledge_base）
    
    【Knowledge Baseモード】
    ↓ 9a. Bedrock Knowledge Base検索
    ↓ 10a. 関連ドキュメント取得
    ↓ 11a. コンテキスト付きプロンプト生成
    
    【Generalモード】
    ↓ 9b. 直接プロンプト使用
    
    ↓ 12. Bedrock Converse API呼び出し
[Bedrock]
    ↓ 13. ストリーミングレスポンス生成
[Lambda]
    ↓ 14. SSE形式でストリーミング
    ↓ 15. DynamoDB履歴保存
[フロントエンド]
    ↓ 16. リアルタイム表示
```

#### データ形式
```javascript
// リクエスト
{
  "user_prompt": "質問内容",
  "chat_id": "チャットID",
  "mode": "knowledge_base", // または "general"
  "model": "nova-lite", // モデル選択
  "user_message_id": "UUID",
  "assistant_message_id": "UUID"
}

// SSEレスポンス
event: message
data: {"type":"message","data":"レスポンステキスト"}

event: end
data: "Stream ended"
```

### 2. ファイル付きチャット（画像・PDF）

#### アップロードフロー
```
[フロントエンド: MessageInput]
    ↓ 1. ファイル選択（最大5MB）
    ↓ 2. ファイル検証
    ↓ 3. 画像圧縮処理（3.75MB以下に）
[imageUploadApi]
    ↓ 4. Presigned URL取得要求
    ↓ 5. fetch('POST /presigned-url')
[API Gateway]
    ↓ 6. JWT認証
[Lambda: rag-prompt-images]
    ↓ 7. S3 Presigned URL生成
    ↓ 8. レスポンス返却
[フロントエンド]
    ↓ 9. S3へ直接アップロード（PUT）
[S3]
    ↓ 10. ファイル保存完了
[フロントエンド]
    ↓ 11. s3Keyをメッセージに含めて送信
```

#### 処理フロー
```
[Lambda: rag-sse-stream]
    ↓ 1. s3Key受信
    ↓ 2. S3からファイル読み込み
    ↓ 3. バイト配列に変換
    ↓ 4. Bedrock形式に変換
        - 画像: {image: {format, source: {bytes}}}
        - PDF: {document: {format, name, source: {bytes}}}
    ↓ 5. Bedrock Converse APIへ送信
    ↓ 6. 画像/PDF解析結果を含むレスポンス
```

---

## ファイルアップロード機能

### 制限事項
- **アップロード最大サイズ**: 5MB
- **Bedrock送信時**: 3.75MB以下（自動圧縮）
- **対応フォーマット**: 
  - 画像: JPEG, PNG, GIF, WebP
  - ドキュメント: PDF

### 圧縮処理（画像のみ）
```
[imageCompressor.ts]
1. 5MB以下 → そのまま
2. 5MB超過 → エラー（アップロード拒否）
3. 3.75MB超過 → 自動圧縮
   - 初回: 品質70%, 2048x2048
   - 再圧縮: 品質50%, 2048x2048
```

---

## API エンドポイント一覧

### 認証不要
```
OPTIONS /* - CORS プリフライト
```

### 認証必要（JWT）

#### チャット関連
```
POST   /chat/stream         - メッセージ送信（SSEストリーミング）
GET    /chats               - チャット履歴一覧取得
GET    /chats/{chatId}      - 特定チャット詳細取得
POST   /chats/search        - チャット検索
```

#### ファイル関連
```
POST   /presigned-url       - S3アップロード用URL取得
POST   /get-image           - 生成画像取得
POST   /generate-image      - AI画像生成
```

### Lambda Function URL（直接アクセス）
```
POST   https://xxx.lambda-url.region.on.aws/  - SSEストリーミング
```

---

## データフロー詳細

### 1. DynamoDB データ構造
```javascript
{
  "userId": "cognito-user-id",
  "chats": [
    {
      "id": "chat-uuid",
      "title": "チャットタイトル",
      "messages": [
        {
          "id": "message-uuid",
          "role": "user|assistant",
          "content": "メッセージ内容",
          "attachment": {
            "fileName": "ファイル名",
            "fileType": "image/jpeg",
            "s3Key": "uploads/userId/...",
            "size": 1234567
          },
          "mode": "general|knowledge_base",
          "model": "nova-lite"
        }
      ]
    }
  ]
}
```

### 2. S3 ファイル構造
```
bucket-name/
├── uploads/
│   └── {userId}/
│       └── {timestamp}-{randomId}-{filename}
└── generated/
    └── {userId}/
        └── {timestamp}-generated.png
```

### 3. Bedrock Knowledge Base 構成
```
[Aurora PostgreSQL]
    ↓ ベクトル化
[Bedrock Titan Embeddings]
    ↓ 保存
[pgvector]
    ↓ 検索時
[Hybrid Search (セマンティック + キーワード)]
    ↓ 関連ドキュメント取得
[コンテキスト生成]
```

---

## エラーハンドリング

### フロントエンド
```javascript
try {
  // API呼び出し
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    // トークンリフレッシュ
    await refreshToken();
    // リトライ
  } else if (error.message.includes('5MB')) {
    // ファイルサイズエラー表示
  } else {
    // 一般エラー表示
  }
}
```

### バックエンド
```javascript
// Lambda エラーレスポンス
{
  statusCode: 400,
  body: JSON.stringify({
    error: "エラーメッセージ"
  })
}

// SSE エラーイベント
event: error
data: "エラーメッセージ"
```

---

## セキュリティ

### 認証・認可
- Cognito User Pool によるユーザー管理
- JWT トークンによる API 認証
- 管理者承認制によるアカウント有効化

### データ保護
- S3: バケットポリシーによるアクセス制限
- DynamoDB: IAM ロールベースアクセス
- Lambda: 最小権限の原則

### 通信
- HTTPS/TLS による暗号化
- CloudFront による DDoS 保護
- CORS 設定による オリジン制限

---

## パフォーマンス最適化

### フロントエンド
- 画像自動圧縮（3.75MB以下）
- React.lazy による コード分割
- Zustand による 効率的な状態管理

### バックエンド
- Lambda Response Streaming による低レイテンシ
- DynamoDB による高速データアクセス
- S3 Presigned URL による直接アップロード

### キャッシュ
- CloudFront による静的アセットキャッシュ
- ブラウザキャッシュの活用

---

## モニタリング・ログ

### CloudWatch Logs
- Lambda 実行ログ
- API Gateway アクセスログ
- エラートラッキング

### メトリクス
- Lambda 実行時間・エラー率
- API Gateway レスポンスタイム
- DynamoDB 読み書きキャパシティ

---

## デプロイメント

### CDK スタック構成
```
1. RagchatCommonStack
   - VPC, Aurora, Bedrock Knowledge Base
   
2. RagchatServiceStack
   - Lambda, DynamoDB, API Gateway, Cognito
   
3. RagchatFrontendStack
   - S3, CloudFront, Frontend Build
```

### デプロイコマンド
```bash
# バックエンド
cd cdk
npm run deploy

# フロントエンド
cd frontend
npm run build
# S3へアップロード
```

---

## 今後の改善ポイント

1. **S3 URI サポート**
   - 現在: bytes 送信（3.75MB制限）
   - 将来: S3 URI 対応モデル使用で大容量ファイル対応

2. **リアルタイム通信**
   - WebSocket による双方向通信

3. **キャッシュ戦略**
   - Redis による セッションキャッシュ
   - Knowledge Base 検索結果キャッシュ

4. **スケーラビリティ**
   - Lambda 同時実行数の最適化
   - DynamoDB オンデマンドスケーリング
