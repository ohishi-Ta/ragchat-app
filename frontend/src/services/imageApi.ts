// src/services/imageApi.ts
import type { ImageGenerationRequest, ImageGenerationResponse } from '../types/image';
import { getCurrentToken } from '../utils/auth';

// 画像生成専用のLambda Function URL
const IMAGE_LAMBDA_FUNCTION_URL = import.meta.env.VITE_APP_IMAGE_LAMBDA_FUNCTION_URL;

export const imageApi = {
  // Lambda Function URL経由で画像生成（同期処理）
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      if (!IMAGE_LAMBDA_FUNCTION_URL) {
        throw new Error('画像生成Lambda Function URLが設定されていません。環境変数VITE_APP_IMAGE_LAMBDA_FUNCTION_URLを確認してください。');
      }
      
      console.log('画像生成リクエスト開始:', {
        url: IMAGE_LAMBDA_FUNCTION_URL,
        request: {
          ...request,
          // セキュリティのため、実際のプロンプトは一部のみログ出力
          prompt: request.prompt.substring(0, 50) + '...'
        }
      });
      
      const response = await fetch(IMAGE_LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
          // CORSヘッダーは不要（Lambda Function URLで処理される）
        },
        body: JSON.stringify({
          prompt: request.prompt,
          negativePrompt: request.negativePrompt || '',
          width: request.width || 1024,
          height: request.height || 1024,
          seed: request.seed || null,
          numberOfImages: request.numberOfImages || 1
        })
      });

      console.log('Lambda Function URLレスポンス:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()])
      });

      if (!response.ok) {
        let errorMessage = `HTTPエラー: ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('Lambda Function URLエラー詳細:', errorData);
        } catch (parseError) {
          console.error('エラーレスポンスのパースに失敗:', parseError);
          // HTMLエラーページなどの場合は、テキストとして取得を試行
          try {
            const errorText = await response.text();
            console.error('エラーレスポンス（テキスト）:', errorText.substring(0, 500));
          } catch (textError) {
            console.error('エラーレスポンステキストの取得にも失敗:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      console.log('画像生成成功:', {
        success: responseData.success,
        imageCount: responseData.images?.length || 0,
        totalCount: responseData.totalCount
      });

      // レスポンス形式の検証
      if (!responseData.success) {
        throw new Error(responseData.error || '画像生成に失敗しました');
      }

      if (!responseData.images || !Array.isArray(responseData.images)) {
        throw new Error('無効なレスポンス形式: images配列が見つかりません');
      }

      return responseData;
    } catch (error) {
      console.error('画像生成APIエラー:', error);
      
      // ネットワークエラーやタイムアウトの場合の詳細ログ
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('ネットワークエラー詳細:', {
          message: error.message,
          url: IMAGE_LAMBDA_FUNCTION_URL,
          userAgent: navigator.userAgent
        });
        throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
      }
      
      throw error;
    }
  },

  // 開発・デバッグ用: Lambda Function URLの疎通確認
  async testConnection(): Promise<boolean> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken || !IMAGE_LAMBDA_FUNCTION_URL) {
        return false;
      }
      
      // OPTIONSリクエストでCORS設定を確認
      const response = await fetch(IMAGE_LAMBDA_FUNCTION_URL, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });
      
      console.log('Lambda Function URL疎通テスト:', {
        status: response.status,
        headers: Object.fromEntries([...response.headers.entries()])
      });
      
      return response.ok;
    } catch (error) {
      console.error('Lambda Function URL疎通テストエラー:', error);
      return false;
    }
  }
};