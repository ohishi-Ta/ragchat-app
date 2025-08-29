// src/hooks/usePresignedUrl.ts - 簡素化版
import { useState, useEffect, useCallback, useRef } from 'react';
import { fileApi } from '../services/fileApi';
import { getErrorMessage } from '../utils/errorUtils';

export const usePresignedUrl = (
  s3Key: string | null, 
  initialUrl?: string, 
  initialExpiresAt?: number
) => {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(initialUrl || null);
  const [isLoading, setIsLoading] = useState(!initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(initialExpiresAt || null);
  
  const isRefreshingRef = useRef(false);
  
  // 🔄 Presigned URL更新関数
  const refreshUrl = useCallback(async (force = false) => {
    if (!s3Key) return;
    if (isRefreshingRef.current && !force) return;
    
    try {
      isRefreshingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Presigned URL更新開始:', { s3Key, force });
      
      const response = await fileApi.getChatAttachmentPresignedUrl(s3Key);
      
      setPresignedUrl(response.presignedUrl);
      setExpiresAt(response.expiresAt);
      
      console.log('Presigned URL更新完了:', {
        s3Key,
        expiresAt: new Date(response.expiresAt).toISOString()
      });
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error('Presigned URL更新エラー:', { s3Key, error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [s3Key]);
  
  // 初回URL取得のみ
  useEffect(() => {
    if (!s3Key) return;
    
    if (!presignedUrl) {
      refreshUrl();
    }
  }, [s3Key, presignedUrl, refreshUrl]);
  
  // ⚡ 期限切れ直前チェック
  const isExpiringSoon = useCallback(() => {
    if (!expiresAt) return false;
    const bufferTime = 5 * 60 * 1000; // 5分前
    return (expiresAt - Date.now()) < bufferTime;
  }, [expiresAt]);
  
  // 🔄 手動更新
  const retry = useCallback(() => {
    setError(null);
    refreshUrl(true);
  }, [refreshUrl]);
  
  // 📊 URL有効性チェック
  const isValid = useCallback(() => {
    if (!presignedUrl || !expiresAt) return false;
    return Date.now() < expiresAt;
  }, [presignedUrl, expiresAt]);
  
  // 🔄 必要時更新（オプション）
  const refreshIfNeeded = useCallback(async () => {
    if (!expiresAt || !s3Key) return false;
    
    const timeLeft = expiresAt - Date.now();
    
    if (timeLeft <= 5 * 60 * 1000) { // 5分以内
      console.log('🔄 期限間近のため必要時更新:', {
        s3Key,
        timeLeft: Math.round(timeLeft / 1000) + '秒'
      });
      
      try {
        await refreshUrl(true);
        return true;
      } catch (error) {
        console.error('必要時更新エラー:', error);
        return false;
      }
    }
    
    return false;
  }, [expiresAt, s3Key, refreshUrl]);
  
  return {
    presignedUrl,
    isLoading,
    error,
    expiresAt,
    isExpiringSoon: isExpiringSoon(),
    isValid: isValid(),
    refreshUrl: () => refreshUrl(true),
    retry,
    refreshIfNeeded // オプション：ダウンロード前などに使用
  };
};