// src/utils/errorUtils.ts - TypeScript strict mode対応
/**
 * unknown型のエラーから安全にメッセージを取得
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return String(error);
};

/**
 * unknown型のエラーがError instanceかどうかをチェック
 */
export const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

/**
 * エラーログ用の安全なオブジェクト生成
 */
export const createErrorLog = (error: unknown, context?: Record<string, any>) => {
  const baseLog = {
    error: getErrorMessage(error),
    errorType: isError(error) ? error.constructor.name : typeof error,
    stack: isError(error) ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  return baseLog;
};

/**
 * API エラーの詳細情報を抽出
 */
export const extractApiError = (error: unknown): {
  message: string;
  status?: number;
  code?: string;
} => {
  if (isError(error)) {
    // Fetch API エラーの場合
    if (error.message.includes('fetch')) {
      return {
        message: 'ネットワークエラーが発生しました',
        code: 'NETWORK_ERROR'
      };
    }
    
    // HTTP ステータスエラーの抽出
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return {
        message: error.message,
        status,
        code: `HTTP_${status}`
      };
    }
    
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR'
    };
  }
  
  return {
    message: getErrorMessage(error),
    code: 'UNKNOWN_ERROR'
  };
};