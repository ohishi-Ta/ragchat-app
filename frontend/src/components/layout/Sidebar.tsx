import React, { useState, useRef, useEffect } from 'react';
import { LuPlus, LuTrash2, LuEllipsis } from 'react-icons/lu';
import type { ChatThread, ModelType } from '../../types/chat';
import ModelSelector from '../features/ModelSelector';
import SearchInput from '../features/SearchInput';

interface SidebarProps {
  chats: ChatThread[];
  activeChatId: string | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  onChatDelete: (chatId: string) => void;
  userEmail: string | undefined;
  onSignOut: () => void;
  className?: string;
  model: ModelType;
  onModelChange: (newModel: ModelType) => void;
  onSearchSubmit: (query: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onNewChat,
  onChatSelect,
  onChatDelete,
  userEmail,
  onSignOut,
  className = '',
  model,
  onModelChange,
  onSearchSubmit
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && menuRefs.current[activeMenuId] && 
          !menuRefs.current[activeMenuId]?.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  const handleMenuToggle = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveMenuId(activeMenuId === chatId ? null : chatId);
  };

  const handleDeleteClick = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDeleteModal(chatId);
    setActiveMenuId(null);
  };

  const handleConfirmDelete = () => {
    if (showDeleteModal) {
      onChatDelete(showDeleteModal);
      setShowDeleteModal(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(null);
  };

  const handleChatClick = (chatId: string) => {
    onChatSelect(chatId);
    setActiveMenuId(null);
  };

  return (
    <>
      <aside className={`sidebar ${className}`}>
        <div className="sidebar-header">
          RagChat
        </div>

        <ModelSelector 
          model={model}
          onModelChange={onModelChange}
        />

        <SearchInput onSearchSubmit={onSearchSubmit} />

        <button onClick={onNewChat} className="new-chat-button">
          <LuPlus />
          新しいチャット
        </button>

        <nav className="history-nav">
          {chats.length > 0 ? (
            <ul>
              {chats.map((chat) => (
                <li
                  key={chat.id}
                  className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                >
                  <div 
                    className="chat-title"
                    onClick={() => handleChatClick(chat.id)}
                  >
                    {chat.title}
                  </div>
                  <div 
                    className="chat-menu-container"
                    ref={(el) => { menuRefs.current[chat.id] = el; }}
                  >
                    <button
                      className="chat-menu-button"
                      onClick={(e) => handleMenuToggle(chat.id, e)}
                      title="メニュー"
                    >
                      <LuEllipsis />
                    </button>
                    {activeMenuId === chat.id && (
                      <div className="chat-menu">
                        <button
                          className="menu-item delete"
                          onClick={(e) => handleDeleteClick(chat.id, e)}
                        >
                          <LuTrash2 />
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-chats">チャット履歴がありません。</p>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <span>{userEmail}</span>
          <button onClick={onSignOut} className="signout-button">
            サインアウト
          </button>
        </div>
      </aside>

      {/* 削除確認モーダル */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>チャットを削除</h3>
            </div>
            <div className="modal-body">
              <p>このチャットを削除しますか？</p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button secondary"
                onClick={handleCancelDelete}
              >
                キャンセル
              </button>
              <button 
                className="modal-button danger"
                onClick={handleConfirmDelete}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;