import { useState } from 'react';
import type { FileAttachment } from '../types/file';
import { imageUploadApi } from '../services/imageUploadApi';
import { autoCompressImage, createPreviewUrl } from '../utils/imageCompressor';
import { getErrorMessage } from '../utils/errorUtils';

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
      const validation = imageUploadApi.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      setUploadProgress(10);
      
      // プレビューURL生成
      const previewUrl = await createPreviewUrl(file);
      
      setUploadProgress(20);

      let fileToUpload = file;
      
      // ファイル種別による処理分岐
      if (file.type.startsWith('image/')) {
        // 画像の場合：Bedrock制限(5MB)対応の圧縮
        const compressionResult = await autoCompressImage(file);
        if (compressionResult) {
          fileToUpload = compressionResult.file;
          console.log(`画像圧縮: ${file.size} → ${compressionResult.compressedSize}`);
          
          // 圧縮後もBedrock制限を確認
          const bedrockValidation = imageUploadApi.validateForBedrock(fileToUpload);
          if (!bedrockValidation.isValid) {
            throw new Error(bedrockValidation.error);
          }
        }
      } else if (file.type === 'application/pdf') {
        // PDFの場合：そのまま使用（圧縮なし）
        console.log(`PDF処理: ${file.name}, サイズ: ${file.size}`);
      }

      setUploadProgress(40);

      // S3アップロード
      const presignedData = await imageUploadApi.getPresignedUrl({
        fileName: fileToUpload.name,
        fileType: fileToUpload.type,
        fileSize: fileToUpload.size
      });

      setUploadProgress(70);

      await imageUploadApi.uploadToS3(fileToUpload, presignedData.uploadUrl, fileToUpload.type);

      setUploadProgress(90);
      
      // FileAttachmentオブジェクト作成（S3キーのみ、Base64データなし）
      const newAttachment: FileAttachment = {
        fileName: fileToUpload.name,
        fileType: fileToUpload.type,
        size: fileToUpload.size,
        s3Key: presignedData.s3Key,
        displayUrl: previewUrl
      };
      
      setAttachedFile(newAttachment);
      setUploadProgress(100);

      console.log('ファイル添付完了:', presignedData.s3Key);

    } catch (error) {
      console.error('ファイル処理エラー:', error);
      const errorMessage = getErrorMessage(error);
      setUploadError(errorMessage);
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