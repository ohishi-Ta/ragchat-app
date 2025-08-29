import { useState } from 'react';
import type { SearchResult } from '../types/search';
import { searchApi } from '../services/searchApi';

export const useSearch = () => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  const handleSearchSubmit = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchQuery(query);
    setIsSearchMode(true);

    try {
      const response = await searchApi.searchChats(query, 20, 0);
      setSearchResults(response.results);
    } catch (error) {
      console.error('検索エラー:', error);
      setSearchError('検索中にエラーが発生しました');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const exitSearchMode = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
  };

  return {
    searchResults,
    searchQuery,
    isSearching,
    searchError,
    isSearchMode,
    handleSearchSubmit,
    exitSearchMode
  };
};