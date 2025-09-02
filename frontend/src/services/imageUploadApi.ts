import { getCurrentToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  expiresAt: number;
  method: string;
  headers: {
    'Content-Type': string;
  };
}

export const imageUploadApi = {
  /**
   * 画像アップロード用のPresigned URLを取得
   */
  async getPresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const currentToken = await getCurrentToken();
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }
    
    const response = await fetch(`${API_BASE_URL}/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Presigned URL取得エラー: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * S3に画像を直接アップロード
   */
  async uploadToS3(file: File | Blob, uploadUrl: string, contentType: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!response.ok) {
      throw new Error(`S3アップロードエラー: ${response.status} ${response.statusText}`);
    }
  },

  /**
   * ファイル検証（画像とPDF対応、画像10MB/PDF4.5MB制限）
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    const ALLOWED_TYPES = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'application/pdf'
    ];
    const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB制限
    const PDF_MAX_SIZE = 4.5 * 1024 * 1024; // 4.5MB制限

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `サポートされていないファイル形式です。対応形式: 画像（JPEG, PNG, GIF, WebP）、PDF`
      };
    }

    // ファイル種別ごとのサイズ制限チェック
    if (file.type === 'application/pdf') {
      if (file.size > PDF_MAX_SIZE) {
        return {
          isValid: false,
          error: `PDFファイルサイズが大きすぎます。最大サイズ: 4.5MB`
        };
      }
    } else if (file.type.startsWith('image/')) {
      if (file.size > IMAGE_MAX_SIZE) {
        return {
          isValid: false,
          error: `画像ファイルサイズが大きすぎます。最大サイズ: 10MB`
        };
      }
    }

    return { isValid: true };
  },

  /**
   * アップロード後のファイルサイズ検証（Bedrock制限）
   */
  validateForBedrock(file: File): { isValid: boolean; error?: string } {
    const BEDROCK_IMAGE_LIMIT = 3.5 * 1024 * 1024; // 3.5MB
    
    if (file.type.startsWith('image/') && file.size > BEDROCK_IMAGE_LIMIT) {
      return {
        isValid: false,
        error: `画像ファイルがBedrock制限(3.5MB)を超過しています: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      };
    }
    
    return { isValid: true };
  }
};