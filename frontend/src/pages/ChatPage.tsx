// src/pages/ChatPage.tsx - useLocalStorage対応版

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ChatMode, ModelType } from '../types/chat';
import { useChat } from '../hooks/useChat';
import { useFileUpload } from '../hooks/useFileUpload';
import { useSearch } from '../hooks/useSearch';
import useLocalStorage from '../hooks/useLocalStorage'; // 🎯 追加
import { getUserEmail } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';
import SignOutConfirmationModal from '../components/common/SignOutConfirmationModal';

interface ChatPageProps {
  user: any;
  signOut: () => void;
}

function ChatPage({ user, signOut }: ChatPageProps) {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  
  const [prompt, setPrompt] = useState<string>('');
  
  // 🎯 useLocalStorageで状態管理（リロード後も保持される）
  const [mode, setMode] = useLocalStorage<ChatMode>('cpi-chat-mode', 'general');
  const [model, setModel] = useLocalStorage<ModelType>('cpi-chat-model', 'nova-lite');
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // カスタムフックの使用
  const {
    chats,
    activeChatId,
    activeMessages,
    isLoading,
    startNewChat,
    handleChatSelect,
    handleChatDelete,
    handleSendMessage,
    handleStopGeneration
  } = useChat(user);

  const {
    attachedFile,
    isUploading,
    uploadProgress,
    uploadError,
    handleFileAttach,
    handleFileRemove
  } = useFileUpload();

  const {
    searchResults,
    searchQuery,
    isSearching,
    searchError,
    isSearchMode,
    handleSearchSubmit,
    exitSearchMode
  } = useSearch();

  // 認証済みユーザーの情報取得
  const userEmail = getUserEmail(user);

  // 📍 URLパラメータからチャットIDを取得してアクティブにする
  useEffect(() => {
    if (chatId && chats.length > 0) {
      const targetChat = chats.find(chat => chat.id === chatId);
      if (targetChat && activeChatId !== chatId) {
        handleChatSelect(chatId);
      }
    }
    // 🎯 URLにchatIdがない場合の処理は削除（新しいチャットボタンでのみ実行）
  }, [chatId, chats]);

  // モバイルサイドバー制御
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  // サインアウト処理
  const handleSignOutRequest = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmedSignOut = async () => {
    setShowSignOutModal(false);
    
    try {
      await signOut();
    } catch (error) {
      console.error("サインアウトエラー:", error);
    }
  };

  const handleCancelSignOut = () => {
    setShowSignOutModal(false);
  };

  // 検索実行ハンドラー（モバイルサイドバー自動クローズ対応）
  const handleSearchSubmitWithMobileClose = async (query: string) => {
    await handleSearchSubmit(query);
    setIsMobileSidebarOpen(false);
  };

  // 検索結果クリックハンドラー
  const handleSearchResultClick = (resultChatId: string) => {
    exitSearchMode();
    navigate(`/chat/${resultChatId}`);
  };

  // メッセージ送信処理
  const handleSendPrompt = async () => {
    const currentPrompt = prompt;
    const currentFile = attachedFile;
    
    setPrompt('');
    handleFileRemove();
    
    await handleSendMessage(currentPrompt, mode, model, currentFile);
  };

  // 新しいチャット開始
  const handleNewChat = () => {
    exitSearchMode();
    startNewChat();
    setPrompt('');
    handleFileRemove();
    closeMobileSidebar();
    navigate('/chat');
  };

  // チャット選択（URL更新対応）
  const handleChatSelectWithNavigation = (selectedChatId: string) => {
    exitSearchMode();
    closeMobileSidebar();
    navigate(`/chat/${selectedChatId}`);
  };

  return (
    <div className="app-layout">
      <div 
        className={`mobile-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
      />
      
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelectWithNavigation}
        onChatDelete={handleChatDelete}
        userEmail={userEmail}
        onSignOut={handleSignOutRequest}
        className={isMobileSidebarOpen ? 'mobile-open' : ''}
        model={model}
        onModelChange={setModel} // 🎯 useLocalStorageのsetterを直接使用
        onSearchSubmit={handleSearchSubmitWithMobileClose}
      />
      
      <MainContent 
        messages={activeMessages}
        prompt={prompt}
        isLoading={isLoading}
        onPromptChange={setPrompt}
        onSendMessage={handleSendPrompt}
        onStopGeneration={handleStopGeneration}
        mode={mode}
        onModeChange={setMode} // 🎯 useLocalStorageのsetterを直接使用
        onToggleSidebar={toggleMobileSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
        attachedFile={attachedFile}
        onFileAttach={handleFileAttach}
        onFileRemove={handleFileRemove}
        uploadProgress={{
          isUploading,
          progress: uploadProgress,
          error: uploadError
        }}
        searchResults={searchResults}
        searchQuery={searchQuery}
        isSearching={isSearching}
        searchError={searchError}
        isSearchMode={isSearchMode}
        onSearchResultClick={handleSearchResultClick}
        activeChatId={activeChatId}
      />

      <SignOutConfirmationModal
        isOpen={showSignOutModal}
        onConfirm={handleConfirmedSignOut}
        onCancel={handleCancelSignOut}
        userEmail={userEmail}
      />
    </div>
  );
}

export default ChatPage;