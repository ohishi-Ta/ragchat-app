// src/utils/imageUtils.ts

/**
 * ArrayBufferをBase64文字列に安全に変換する
 * スタックオーバーフローを避けるためにFileReaderを使用
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer, mimeType: string = 'image/png'): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type: mimeType });
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/png;base64, の部分を除去してBase64データのみを返す
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      
      reader.onerror = () => {
        reject(new Error('Base64変換でエラーが発生しました'));
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Presigned URLから画像を取得してBase64データとして返す
 */
export const fetchImageFromPresignedUrl = async (presignedUrl: string): Promise<string> => {
  try {
    console.log('画像取得開始:', { url: presignedUrl.substring(0, 100) + '...' });
    
    const response = await fetch(presignedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/png, image/jpeg, image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`画像取得失敗: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/png';
    
    console.log('画像取得成功:', {
      size: arrayBuffer.byteLength,
      contentType
    });
    
    // FileReaderを使用してBase64変換（スタックオーバーフロー回避）
    const base64Data = await arrayBufferToBase64(arrayBuffer, contentType);
    
    return base64Data;
  } catch (error) {
    console.error('Presigned URL画像取得エラー:', error);
    throw error;
  }
};

/**
 * 画像データのサイズをチェックして警告を出力
 */
export const checkImageSize = (sizeInBytes: number): void => {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  if (sizeInMB > 5) {
    console.warn(`画像サイズが大きいです: ${sizeInMB.toFixed(2)}MB`);
  } else if (sizeInMB > 2) {
    console.info(`画像サイズ: ${sizeInMB.toFixed(2)}MB`);
  }
};

/**
 * Base64データのサイズを計算
 */
export const calculateBase64Size = (base64String: string): number => {
  // Base64エンコードでは3バイトが4文字になるため、元のサイズは約3/4
  const padding = (base64String.match(/=/g) || []).length;
  return Math.floor((base64String.length * 3) / 4) - padding;
};