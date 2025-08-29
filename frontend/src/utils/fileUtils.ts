export const getFileSizeLimit = (): number => {
  return 3.75 * 1024 * 1024; // 3.75MB
};

export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<{base64Data: string; blob: Blob}> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      // アスペクト比を保持してリサイズ
      const { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxWidth / height);
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      
      // 描画
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Base64とBlobの両方を生成
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Data = compressedDataUrl.split(',')[1];
      
      // Blobに変換（S3アップロード用）
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ base64Data, blob });
        } else {
          reject(new Error('圧縮に失敗しました'));
        }
      }, 'image/jpeg', quality);
    };
    
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
};

export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = getFileSizeLimit();
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024) * 100) / 100;
    return {
      isValid: false,
      error: `ファイルサイズが制限を超えています。最大${maxSizeMB}MBまでです。`
    };
  }
  
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    return {
      isValid: false,
      error: '画像(JPG, PNG, GIFなど)またはPDFファイルを選択してください。'
    };
  }
  
  return { isValid: true };
};