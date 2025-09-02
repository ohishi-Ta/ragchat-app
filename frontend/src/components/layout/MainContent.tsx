
import React from 'react';
import { LuMenu, LuX } from 'react-icons/lu';
import type { Message, ChatMode, ModelType } from '../../types/chat';
import type { FileAttachment, UploadProgress } from '../../types/file';
import type { SearchResult } from '../../types/search';
import MessageList from '../features/MessageList';
import MessageInput from '../features/MessageInput';
import SearchResults from '../features/SearchResults';

interface MainContentProps {
  messages: Message[];
  prompt: string;
  isLoading: boolean;
  onPromptChange: (newPrompt: string) => void;
  onSendMessage: () => void;
  onStopGeneration?: () => void;
  mode: ChatMode;
  model: ModelType;
  onModeChange: (newMode: ChatMode) => void;
  onToggleSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  attachedFile: FileAttachment | null;
  onFileAttach: (file: File) => void;
  onFileRemove: () => void;
  uploadProgress: UploadProgress;
  // 検索関連のプロパティ
  searchResults?: SearchResult[];
  searchQuery?: string;
  isSearching?: boolean;
  searchError?: string | null;
  isSearchMode?: boolean;
  onSearchResultClick?: (chatId: string) => void;
  activeChatId?: string | null;
}

const MainContent: React.FC<MainContentProps> = ({
  messages,
  prompt,
  isLoading,
  onPromptChange,
  onSendMessage,
  onStopGeneration,
  mode,
  model,
  onModeChange,
  onToggleSidebar,
  isMobileSidebarOpen = false,
  attachedFile,
  onFileAttach,
  onFileRemove,
  uploadProgress,
  // 検索関連のプロパティ
  searchResults = [],
  searchQuery = '',
  isSearching = false,
  searchError = null,
  isSearchMode = false,
  onSearchResultClick,
  activeChatId = null
}) => {
  return (
    <main className="main-content">
      {/* モバイル用ヘッダー */}
      <div className="mobile-header">
        <button 
          className={`mobile-menu-button ${isMobileSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title={isMobileSidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {isMobileSidebarOpen ? <LuX /> : <LuMenu />}
        </button>
        <div className="mobile-title">RagChat</div>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="chat-area-wrapper">
        {/* 検索モード時は検索結果を表示、通常時はチャットメッセージを表示 */}
        {isSearchMode ? (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            isLoading={isSearching}
            error={searchError}
            onResultClick={onSearchResultClick || (() => {})}
            activeChatId={activeChatId}
          />
        ) : (
          <MessageList 
            messages={messages}
            isLoading={isLoading}
          />
        )}
        
        {/* 検索モード時は入力エリアを非表示 */}
        {!isSearchMode && (
          <MessageInput
            prompt={prompt}
            onPromptChange={onPromptChange}
            onSendMessage={onSendMessage}
            onStopGeneration={onStopGeneration}
            isLoading={isLoading}
            mode={mode}
            model={model}
            onModeChange={onModeChange}
            attachedFile={attachedFile}
            onFileAttach={onFileAttach}
            onFileRemove={onFileRemove}
            uploadProgress={uploadProgress}
          />
        )}
      </div>
    </main>
  );
};

export default MainContent;