import React, { useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

interface SearchInputProps {
  onSearchSubmit: (query: string) => void;
}

const SearchInput: React.FC<SearchInputProps> = ({ onSearchSubmit }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      onSearchSubmit(trimmedQuery);
      // 検索実行後に検索窓をクリア
      setSearchQuery('');
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSearchSubmit} className="search-form">
        <div className="search-input-wrapper">
          <LuSearch className="search-icon" />
          <input
            type="text"
            placeholder="チャットを検索..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            className="search-input"
          />
          {searchQuery && (
            <button 
              type="button"
              className="search-clear-button"
              onClick={() => setSearchQuery('')}
              title="入力をクリア"
            >
              <LuX />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default SearchInput;