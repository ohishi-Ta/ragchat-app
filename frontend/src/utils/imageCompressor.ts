// 型定義
export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'jpeg' | 'png' | 'webp';
}

export interface ImageCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// 定数
export const DEFAULT_COMPRESSION_QUALITY = 0.8;
export const DEFAULT_MAX_WIDTH = 2048;
export const DEFAULT_MAX_HEIGHT = 2048;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - アップロード最大サイズ
export const BEDROCK_IMAGE_LIMIT = 3.5 * 1024 * 1024; // 3.5MB - Bedrock制限

/**
 * Canvas要素で画像を圧縮
 */
export const compressImage = async (
  file: File,
  options: ImageCompressionOptions = {}
): Promise<ImageCompressionResult> => {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_COMPRESSION_QUALITY,
    outputFormat = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not supported'));
      return;
    }

    img.onload = () => {
      try {
        // 元の寸法を取得
        const { width: originalWidth, height: originalHeight } = img;
        
        // アスペクト比を維持しながらリサイズ
        const { width, height } = calculateDimensions(
          originalWidth, 
          originalHeight, 
          maxWidth, 
          maxHeight
        );

        // Canvasに描画
        canvas.width = width;
        canvas.height = height;
        
        // 高品質なリサイズのための設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 背景を白で塗りつぶし（JPEG用）
        if (outputFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        // Blobに変換
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // 新しいFileオブジェクトを作成
            const compressedFile = new File(
              [blob],
              generateCompressedFileName(file.name, outputFormat),
              {
                type: `image/${outputFormat}`,
                lastModified: Date.now()
              }
            );

            const result: ImageCompressionResult = {
              file: compressedFile,
              compressionRatio: file.size / blob.size,
              originalSize: file.size,
              compressedSize: blob.size
            };

            resolve(result);
          },
          `image/${outputFormat}`,
          quality
        );
      } catch (error) {
        reject(new Error(`Image compression failed: ${error}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // ファイルをData URLとして読み込み
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * アスペクト比を保ったまま寸法を計算
 */
const calculateDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  let { width, height } = { width: originalWidth, height: originalHeight };

  // 最大幅を超える場合
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  // 最大高さを超える場合
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
};

/**
 * 圧縮後のファイル名を生成
 */
const generateCompressedFileName = (
  originalName: string,
  format: string
): string => {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}_compressed.${format}`;
};

/**
 * ファイルプレビューURLを生成（画像・PDF対応）
 */
export const createPreviewUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      // 画像の場合：データURLを生成
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      // PDFの場合：ObjectURLを生成（プレビューは別途処理）
      const objectUrl = URL.createObjectURL(file);
      resolve(objectUrl);
    } else {
      reject(new Error('Unsupported file type for preview'));
    }
  });
};

/**
 * 画像の寸法を取得
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 画像を自動圧縮（Bedrock 3.5MB制限対応）
 */
export const autoCompressImage = async (
  file: File
): Promise<ImageCompressionResult | null> => {
  // 3.5MB未満なら圧縮しない
  if (file.size < BEDROCK_IMAGE_LIMIT) {
    return null;
  }

  console.log(`[DEBUG] 画像が3.5MB以上のため圧縮: ${formatFileSize(file.size)}`);

  // 3.5MB以上なら品質70%で圧縮
  const result = await compressImage(file, {
    quality: 0.7,
    maxWidth: 2048,
    maxHeight: 2048
  });

  console.log(`[DEBUG] 圧縮完了: ${formatFileSize(file.size)} → ${formatFileSize(result.compressedSize)}`);

  // それでも3.5MB超えたら品質50%で再圧縮
  if (result.compressedSize > BEDROCK_IMAGE_LIMIT) {
    console.log(`[DEBUG] まだ3.5MBを超えているため品質50%で再圧縮`);
    
    const secondResult = await compressImage(file, {
      quality: 0.5,
      maxWidth: 2048,
      maxHeight: 2048
    });

    if (secondResult.compressedSize > BEDROCK_IMAGE_LIMIT) {
      throw new Error(`画像を3.5MB以下に圧縮できませんでした: ${formatFileSize(secondResult.compressedSize)}`);
    }

    return secondResult;
  }

  return result;
};

/**
 * 複数画像の一括圧縮
 */
export const compressImages = async (
  files: File[],
  options: ImageCompressionOptions = {},
  onProgress?: (progress: number, currentFile: string) => void
): Promise<ImageCompressionResult[]> => {
  const results: ImageCompressionResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(((i + 1) / files.length) * 100, file.name);
    
    try {
      const result = await compressImage(file, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to compress ${file.name}:`, error);
      // エラーが発生してもスキップして続行
    }
  }
  
  return results;
};