export interface FileAttachment {
  fileName: string;
  fileType: string;
  size: number;
  data?: string;       // Base64データ（Bedrock送信用、S3の場合はオプショナル）
  s3Key?: string;      // S3キー（S3アップロード時）
  displayUrl?: string; // 表示用URL
}

export interface UploadProgress {
  isUploading: boolean;
  progress: number;
  error: string | null;
}