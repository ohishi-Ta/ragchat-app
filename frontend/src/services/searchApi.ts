import type { SearchResponse } from '../types/search';
import { getCurrentToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const searchApi = {
  async searchChats(query: string, limit: number = 20, offset: number = 0): Promise<SearchResponse> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      const encodedQuery = encodeURIComponent(query);
      const url = `${API_BASE_URL}/search?q=${encodedQuery}&limit=${limit}&offset=${offset}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`検索エラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('検索APIエラー:', error);
      throw error;
    }
  }
};