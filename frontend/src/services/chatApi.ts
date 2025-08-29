import type { ChatListItem, Message } from '../types/chat';
import { getCurrentToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const chatApi = {
  async fetchChatList(): Promise<ChatListItem[]> {
    const currentToken = await getCurrentToken();
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }
    
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }
    
    return await response.json();
  },

  async fetchChatHistory(chatId: string): Promise<Message[]> {
    const currentToken = await getCurrentToken();
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }

    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }
    
    return await response.json();
  },

  async deleteChat(chatId: string): Promise<boolean> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        console.error('認証トークンが取得できません');
        return false;
      }
      
      const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });

      return response.ok;
    } catch (error) {
      console.error("チャット削除APIエラー:", error);
      return false;
    }
  },

  async sendMessage(payload: any): Promise<Response> {
    const currentToken = await getCurrentToken();
    const lambdaFunctionUrl = import.meta.env.VITE_APP_LAMBDA_FUNCTION_URL;
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }
    
    if (!lambdaFunctionUrl) {
      throw new Error('システム設定エラー: Lambda Function URLが設定されていません');
    }

    const response = await fetch(lambdaFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(payload),
      signal: payload.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      throw new Error('サーバーからSSEストリームが返されませんでした');
    }

    return response;
  }
};