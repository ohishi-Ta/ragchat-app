export interface FileAttachment {
  fileName: string;
  fileType: string;
  size: number;
  data: string;        // Base64データ（Bedrock送信用）
  s3Key: string;       // S3キー（履歴保存用）
  displayUrl: string;  // 表示用URL
}

export interface UploadProgress {
  isUploading: boolean;
  progress: number;
  error: string | null;
}