import React from 'react';
import { LuMessageSquare, LuSearch } from 'react-icons/lu';
import type { SearchResult } from '../../types/search';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  error: string | null;
  onResultClick: (chatId: string) => void;
  activeChatId: string | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  isLoading,
  error,
  onResultClick,
  activeChatId
}) => {
  // マッチしたコンテンツをハイライト表示
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      ) : part
    );
  };

  if (isLoading) {
    return (
      <div className="search-results-container">
        <div className="search-results-header">
          <div className="search-query">
            <LuSearch className="search-query-icon" />
            <span>"{query}" を検索中...</span>
          </div>
        </div>
        <div className="search-loading-state">
          <div className="loading-spinner"></div>
          <p>検索しています...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results-container">
        <div className="search-results-header">
          <div className="search-query">
            <LuSearch className="search-query-icon" />
            <span>"{query}" の検索結果</span>
          </div>
        </div>
        <div className="search-error-state">
          <h3>検索エラー</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <div className="search-query">
          <LuSearch className="search-query-icon" />
          <span>"{query}" の検索結果</span>
        </div>
        <div className="search-results-count">
          {results.length}件見つかりました
        </div>
      </div>

      <div className="search-results-content">
        {results.length === 0 ? (
          <div className="search-empty-state">
            <h3>検索結果が見つかりませんでした</h3>
            <p>別のキーワードで検索してみてください</p>
          </div>
        ) : (
          <div className="search-results-list">
            {results.map((result) => (
              <div
                key={result.chatId}
                className={`search-result-card ${result.chatId === activeChatId ? 'active' : ''}`}
                onClick={() => onResultClick(result.chatId)}
              >
                <div className="search-result-header">
                  <h3 className="search-result-title">
                    {highlightText(result.title, query)}
                  </h3>
                  <div className="search-result-badges">
                    <span className={`match-type-badge ${result.matchType}`}>
                      {result.matchType === 'title' ? 'タイトル' : '内容'}
                    </span>
                  </div>
                </div>

                {result.matchType === 'content' && result.matchedContent && (
                  <div className="search-result-snippet">
                    <LuMessageSquare className="snippet-icon" />
                    <p className="snippet-text">
                      {highlightText(result.matchedContent, query)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;