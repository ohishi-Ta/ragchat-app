// src/hooks/useImageGeneration.ts - Context統合版
import { useState } from 'react';
import type { ImageGenerationRequest, GeneratedImage, GeneratedImageResponse } from '../types/image';
import { useImageContext } from '../contexts/ImageContext';
import { imageApi } from '../services/imageApi';
import { fetchImageFromPresignedUrl, checkImageSize, calculateBase64Size } from '../utils/imageUtils';

export const useImageGeneration = () => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // 🎯 Context から画像状態を取得
  const { generatedImages, setGeneratedImages } = useImageContext();

  const generateImage = async (request: ImageGenerationRequest) => {
    try {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationProgress('画像生成中...');
      
      console.log('画像生成開始:', {
        prompt: request.prompt.substring(0, 50) + '...',
        numberOfImages: request.numberOfImages || 1,
        dimensions: `${request.width || 512}x${request.height || 512}`,
        baseSeed: request.seed
      });
      
      // Lambda Function URL経由で同期処理（S3キーとPresigned URLを取得）
      const response = await imageApi.generateImage(request);
      
      if (response.success && response.images && response.images.length > 0) {
        setGenerationProgress('画像データを取得中...');
        
        // 🎯 シード値の検証とログ出力
        console.log('生成された画像のシード値:', response.images.map(img => ({
          index: img.index || 0,
          seed: img.seed
        })));
        
        // 同じシードの画像がないかチェック
        const seeds = response.images.map(img => img.seed);
        const uniqueSeeds = new Set(seeds);
        if (seeds.length > 1 && uniqueSeeds.size < seeds.length) {
          console.warn('⚠️ 複数画像で同じシードが検出されました:', seeds);
        }
        
        // Presigned URLまたはS3キーから画像データを取得
        const imagesWithData = await Promise.all(
          response.images.map(async (imageInfo: GeneratedImageResponse, index: number): Promise<GeneratedImage | null> => {
            try {
              console.log(`画像${index + 1}の取得開始:`, {
                hasPresignedUrl: !!imageInfo.presignedUrl,
                hasS3Key: !!imageInfo.s3Key,
                seed: imageInfo.seed
              });
              
              let base64String: string;
              
              if (imageInfo.presignedUrl) {
                // 優先: Presigned URLから直接画像を取得（ユーティリティ関数使用）
                console.log(`画像${index + 1}: Presigned URLから取得中...`);
                
                base64String = await fetchImageFromPresignedUrl(imageInfo.presignedUrl);
                
                // データサイズチェック
                const estimatedSize = calculateBase64Size(base64String);
                checkImageSize(estimatedSize);
                
                console.log(`画像${index + 1}: Presigned URLから正常取得`, {
                  base64Length: base64String.length,
                  estimatedSizeBytes: estimatedSize
                });
                
              } else if (imageInfo.s3Key) {
                // フォールバック: 既存のAPI経由でS3から取得
                console.log(`画像${index + 1}: 既存API経由でS3から取得中...`, imageInfo.s3Key);
                
                // この場合は fileApi を使う必要があるが、Lambda Function URL中心の設計では非推奨
                console.warn('Presigned URLが利用できないため、S3キーを使用します（非推奨）');
                throw new Error('Presigned URLが提供されていません');
                
              } else {
                throw new Error('画像データの取得方法が見つかりません（S3キーもPresigned URLも無し）');
              }
              
              // GeneratedImage型に変換
              const completeImage: GeneratedImage = {
                base64: base64String,
                s3Key: imageInfo.s3Key,
                seed: imageInfo.seed,
                prompt: imageInfo.prompt,
                negativePrompt: imageInfo.negativePrompt || '',
                width: imageInfo.width,
                height: imageInfo.height,
                generatedAt: imageInfo.generatedAt,
                index: imageInfo.index || (index + 1)
              };
              
              return completeImage;
              
            } catch (error) {
              console.error(`画像${index + 1}の取得エラー:`, {
                error: error instanceof Error ? error.message : error,
                imageInfo: {
                  hasPresignedUrl: !!imageInfo.presignedUrl,
                  hasS3Key: !!imageInfo.s3Key,
                  seed: imageInfo.seed
                }
              });
              return null;
            }
          })
        );
        
        // nullでない画像のみフィルタ
        const validImages: GeneratedImage[] = imagesWithData.filter((img): img is GeneratedImage => img !== null);
        
        console.log('画像取得結果:', {
          requested: response.images.length,
          successful: validImages.length,
          failed: response.images.length - validImages.length
        });
        
        if (validImages.length === 0) {
          throw new Error('すべての画像の取得に失敗しました');
        }
        
        if (validImages.length < response.images.length) {
          const failedCount = response.images.length - validImages.length;
          console.warn(`${failedCount}枚の画像取得に失敗しましたが、${validImages.length}枚は正常に取得できました`);
        }
        
        // 🎯 Context の状態を更新（永続化される）
        setGeneratedImages(validImages);
        
        console.log('画像生成完了:', {
          totalImages: validImages.length,
          savedToContext: true
        });
        
        return validImages;
      } else {
        throw new Error(response.error || '画像生成レスポンスが無効です');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像生成に失敗しました';
      
      console.error('画像生成エラー:', {
        error: errorMessage,
        request: {
          prompt: request.prompt.substring(0, 50) + '...',
          numberOfImages: request.numberOfImages || 1
        }
      });
      
      setGenerationError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const clearError = () => {
    setGenerationError(null);
  };

  // 🎯 Context の clearImages を使用
  const { clearImages: clearCurrentImages } = useImageContext();

  return {
    isGenerating,
    generatedImages, // 🎯 Context から取得
    generationError,
    generationProgress,
    generateImage,
    clearError,
    clearCurrentImages
  };
};