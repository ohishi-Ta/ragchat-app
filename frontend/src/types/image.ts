// src/types/image.ts - 履歴関連型削除版
export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  saveToS3?: boolean;
  numberOfImages?: number; // 枚数指定
}

export interface GeneratedImage {
  base64: string;
  s3Key?: string;
  seed: number;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  generatedAt: string;
  index?: number; // 複数画像の場合のインデックス
}

// Lambda関数URLからのレスポンス用（base64なし）
export interface GeneratedImageResponse {
  s3Key?: string;
  presignedUrl?: string; // 追加: 直接アクセス用URL
  seed: number;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  generatedAt: string;
  index?: number;
}

export interface ImageGenerationResponse {
  success: boolean;
  images?: GeneratedImageResponse[]; // Lambda関数URLからはS3キーのみ
  image?: GeneratedImage; // 後方互換性のため残す
  totalCount?: number; // 生成された画像の総数
  error?: string;
  details?: string;
}