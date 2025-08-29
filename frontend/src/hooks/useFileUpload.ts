import { useState } from 'react';
import type { FileAttachment } from '../types/file';
import { fileApi } from '../services/fileApi';
import { compressImage, validateFile } from '../utils/fileUtils';

export const useFileUpload = () => {
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileAttach = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      // ファイル検証
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      setUploadProgress(10);
      
      let base64Result: string;
      let s3Result: string;
      
      if (file.type.startsWith('image/')) {
        // 画像の場合: 並行処理（オリジナルBase64 + 圧縮版S3保存）
        const [originalBase64, compressedData] = await Promise.all([
          // 1. オリジナルBase64変換（Bedrock送信用）
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
          
          // 2. 画像圧縮（S3保存用）
          compressImage(file, 800, 0.7)
        ]);
        
        setUploadProgress(60);
        
        // 圧縮版をS3にアップロード
        const { uploadUrl, s3Key } = await fileApi.getPresignedUrl(file.name, 'image/jpeg');
        await fileApi.uploadToS3(compressedData.blob, uploadUrl);
        
        base64Result = originalBase64;
        s3Result = s3Key;
        
      } else {
        // PDFの場合: 従来通り
        const [originalBase64, s3Key] = await Promise.all([
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
          
          (async () => {
            const { uploadUrl, s3Key } = await fileApi.getPresignedUrl(file.name, file.type);
            await fileApi.uploadToS3(file, uploadUrl);
            return s3Key;
          })()
        ]);
        
        base64Result = originalBase64;
        s3Result = s3Key;
      }
      
      setUploadProgress(90);
      
      // ファイル情報を保持
      const newAttachment: FileAttachment = {
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        data: base64Result,      // Bedrock送信用（オリジナル）
        s3Key: s3Result,         // 履歴保存用（圧縮版またはオリジナル）
        displayUrl: `data:${file.type};base64,${base64Result}`
      };
      
      setAttachedFile(newAttachment);
      setUploadProgress(100);

    } catch (error) {
      console.error('ファイル処理エラー:', error);
      setUploadError(error instanceof Error ? error.message : 'ファイルの処理に失敗しました');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadError(null);
      }, 3000);
    }
  };
  
  const handleFileRemove = () => {
    setAttachedFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  return {
    attachedFile,
    isUploading,
    uploadProgress,
    uploadError,
    handleFileAttach,
    handleFileRemove
  };
};