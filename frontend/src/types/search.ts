export interface SearchResult {
  chatId: string;
  title: string;
  matchedContent: string;
  matchType: 'title' | 'content';
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: string;
  limit: number;
  offset: number;
}