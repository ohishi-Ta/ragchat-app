// src/pages/ImageGenerationPage.tsx - useLocalStorage対応版

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { useChat } from '../hooks/useChat';
import { useSearch } from '../hooks/useSearch';
import useLocalStorage from '../hooks/useLocalStorage'; // 🎯 追加
import { getUserEmail } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import ImageGenerationForm from '../components/features/ImageGenerationForm';
import MultiImageDisplay from '../components/features/MultiImageDisplay';
import type { ImageGenerationRequest } from '../types/image';
import type { ModelType } from '../types/chat';

interface ImageGenerationPageProps {
  user: any;
  signOut: () => void;
}

const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({
  user,
  signOut
}) => {
  const navigate = useNavigate();
  const userEmail = getUserEmail(user);
  
  // 🎯 useLocalStorageで状態管理（ChatPageと同じキーを使用して同期）
  const [model, setModel] = useLocalStorage<ModelType>('cpi-chat-model', 'nova-lite');

  // 🎯 Nova Canvas以外のモデルが選択された時の処理
  const handleModelChange = (newModel: ModelType) => {
    setModel(newModel);
    
    // Nova Canvas以外が選択された場合は新しいチャットに遷移
    if (newModel !== 'nova-canvas') {
      startNewChat(); // 新しいチャットを開始
      navigate('/chat'); // チャットページに遷移
    }
  };
  
  // チャット機能のフック
  const {
    chats,
    activeChatId,
    startNewChat,
    handleChatSelect: originalHandleChatSelect,
    handleChatDelete
  } = useChat(user);
  
  const { handleSearchSubmit } = useSearch();
  
  const {
    isGenerating,
    generatedImages,
    generationError,
    generateImage,
    clearError
  } = useImageGeneration();

  const handleGenerate = async (request: ImageGenerationRequest) => {
    try {
      await generateImage(request);
    } catch (error) {
      // エラーはフックで処理済み
    }
  };

  const handleRegenerate = (seed: number) => {
    if (generatedImages.length > 0) {
      const firstImage = generatedImages[0];
      const request: ImageGenerationRequest = {
        prompt: firstImage.prompt,
        negativePrompt: firstImage.negativePrompt || undefined,
        width: firstImage.width,
        height: firstImage.height,
        seed,
        numberOfImages: generatedImages.length
      };
      handleGenerate(request);
    }
  };

  const handleBackToChat = () => {
    if (activeChatId) {
      navigate(`/chat/${activeChatId}`);
    } else {
      navigate('/chat');
    }
  };

  const handleChatSelect = (chatId: string) => {
    // 🎯 履歴スレッド選択時はデフォルトモデルに変更
    setModel('nova-lite'); // デフォルトモデルに変更
    
    originalHandleChatSelect(chatId);
    navigate(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    // 🎯 新しいチャット作成時もデフォルトモデルに変更
    setModel('nova-lite');
    
    startNewChat();
    navigate('/chat');
  };

  const handleSearchSubmitWithNavigation = async (query: string) => {
    await handleSearchSubmit(query);
    navigate('/chat');
  };

  return (
    <div className="app-layout">
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelect}
        onChatDelete={handleChatDelete}
        userEmail={userEmail}
        onSignOut={signOut}
        model={model}
        onModelChange={handleModelChange} // 🎯 カスタムハンドラーを使用
        onSearchSubmit={handleSearchSubmitWithNavigation}
      />
      
      <main className="main-content">
        <div className="image-page-header">
          <button 
            onClick={handleBackToChat}
            className="back-button"
            title="チャットに戻る"
          >
            <LuArrowLeft />
            チャットに戻る
          </button>
          <h1 className="page-title">画像生成</h1>
          <div style={{ width: '120px' }}></div>
        </div>

        <div className="image-page-content">
          <div className="image-form-panel">
            <ImageGenerationForm
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />

            {generationError && (
              <div className="error-message">
                <span>❌ {generationError}</span>
                <button onClick={clearError} className="error-close">×</button>
              </div>
            )}
          </div>

          <div className="image-display-panel">
            {isGenerating && (
              <div className="generating-placeholder">
                <div className="generating-animation">
                  <div className="generating-spinner"></div>
                  <h3>生成中...</h3>
                  <p>しばらくお待ちください</p>
                </div>
              </div>
            )}
            
            {!isGenerating && generatedImages.length > 0 && (
              <MultiImageDisplay
                images={generatedImages}
                onRegenerate={handleRegenerate}
                className="main-image-display"
              />
            )}
            
            {!isGenerating && generatedImages.length === 0 && (
              <div className="empty-placeholder">
                <div className="empty-content">
                  <h3>画像生成</h3>
                  <p>プロンプトを入力して画像を生成してください</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImageGenerationPage;