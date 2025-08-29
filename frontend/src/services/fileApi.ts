// src/services/fileApi.ts - Presigned URLオンリー版
import { getCurrentToken } from '../utils/auth';
import { getErrorMessage, createErrorLog } from '../utils/errorUtils';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const fileApi = {
  // ファイルアップロード用Presigned URL取得
  async getPresignedUrl(fileName: string, fileType: string): Promise<{uploadUrl: string; s3Key: string}> {
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
      body: JSON.stringify({ fileName, fileType })
    });

    if (!response.ok) {
      throw new Error(`Presigned URL取得エラー: ${response.status}`);
    }

    return await response.json();
  },

  // S3へのファイルアップロード
  async uploadToS3(file: File | Blob, uploadUrl: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`S3アップロードエラー: ${response.status}`);
    }
  },

  // 🎯 チャット添付ファイル用Presigned URL取得（唯一の方式）
  async getChatAttachmentPresignedUrl(s3Key: string): Promise<{
    presignedUrl: string; 
    expiresIn: number; 
    expiresAt: number;
    s3Key: string;
  }> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      // チャット添付ファイルかどうかの事前チェック
      if (!s3Key.startsWith('uploads/')) {
        throw new Error('チャット添付ファイルではありません');
      }
      
      console.log('Presigned URL生成リクエスト:', { s3Key });
      
      const response = await fetch(`${API_BASE_URL}/get-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ s3Key }) // responseTypeは不要（Presigned URLのみ）
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Presigned URL取得エラー: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.method !== 'presignedUrl') {
        throw new Error('期待されたレスポンス形式ではありません');
      }

      console.log('Presigned URL生成成功:', {
        s3Key,
        expiresAt: new Date(data.expiresAt).toISOString()
      });

      return {
        presignedUrl: data.presignedUrl,
        expiresIn: data.expiresIn,
        expiresAt: data.expiresAt,
        s3Key: data.s3Key || s3Key
      };
    } catch (error: unknown) {
      console.error('チャット添付ファイルPresigned URL取得エラー:', createErrorLog(error, { s3Key }));
      throw error;
    }
  },

  // 🎯 統合API: 常にPresigned URLを返却
  async getChatAttachmentUrl(s3Key: string): Promise<string> {
    try {
      // 事前チェック: チャット添付ファイルかどうか
      if (!s3Key.startsWith('uploads/')) {
        throw new Error('チャット添付ファイルではありません');
      }
      
      const { presignedUrl } = await this.getChatAttachmentPresignedUrl(s3Key);
      console.log('チャット添付ファイルPresigned URL取得成功:', s3Key);
      return presignedUrl;
      
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('画像URL取得失敗:', {
        s3Key,
        error: errorMessage
      });
      throw new Error(`画像の取得に失敗しました: ${s3Key} - ${errorMessage}`);
    }
  },

  // 🔄 既存メソッド（下位互換性のため）- 内部的にPresigned URLを使用
  async fetchImageFromS3(s3Key: string): Promise<{base64Data: string; contentType: string}> {
    console.warn('fetchImageFromS3は非推奨です。getChatAttachmentPresignedUrlの使用を推奨します。');
    
    // Presigned URLを取得してからfetchでBase64変換（非推奨パス）
    try {
      const { presignedUrl } = await this.getChatAttachmentPresignedUrl(s3Key);
      
      // Presigned URLから画像を取得してBase64に変換
      const response = await fetch(presignedUrl);
      if (!response.ok) {
        throw new Error(`画像取得エラー: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
      
      console.warn('Base64変換完了（非推奨パス）:', { s3Key, contentType });
      
      return { base64Data, contentType };
    } catch (error: unknown) {
      console.error('Base64変換エラー（非推奨パス）:', createErrorLog(error, { s3Key }));
      throw error;
    }
  }
};