import React, { useState, useRef, useLayoutEffect } from 'react';
import { LuUser, LuBot, LuCopy } from 'react-icons/lu';
import { IoArrowDown } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Message } from '../../types/chat';
import { getModelDisplayName } from '../../constants/models';
import { markdownComponents } from '../../utils/markdown';
import AttachmentDisplay from '../ui/AttachmentDisplay';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useLayoutEffect(() => {
    const chatArea = chatAreaRef.current;
    if (chatArea && messages.length > 0) {
      const originalBehavior = chatArea.style.scrollBehavior;
      chatArea.style.scrollBehavior = 'auto';
      chatArea.scrollTop = chatArea.scrollHeight;
      chatArea.style.scrollBehavior = originalBehavior;
    }
  }, [messages, isLoading]);

  const handleScroll = () => {
    const chatArea = chatAreaRef.current;
    if (!chatArea) return;
    const { scrollTop, scrollHeight, clientHeight } = chatArea;
    const isScrolledUp = scrollHeight - scrollTop > clientHeight + 200;
    setShowScrollToBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    const chatArea = chatAreaRef.current;
    if (chatArea) {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleCopy = async (textToCopy: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('コピーに失敗しました。');
    }
  };

  const renderMessage = (msg: Message) => {
    const messageContent = (
      <>
        <div className="message-header">
          <div className="sender-info">
            <div className="icon">{msg.role === 'user' ? <LuUser /> : <LuBot />}</div>
            <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          </div>
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && msg.content === '' && isLoading ? (
            <div className="spinner-dots" />
          ) : (
            <div className="message-text">
              {msg.role === 'user' ? (
                <>
                  {msg.attachment && (
                    <div className="message-attachment" style={{ marginBottom: '12px' }}>
                      <AttachmentDisplay attachment={msg.attachment} />
                    </div>
                  )}
                  {msg.content && <p className="user-message-text">{msg.content}</p>}
                </>
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="message-actions">
          {msg.role === 'assistant' && (
            <div className="message-meta">
              {msg.mode && (
                <span className={`mode-tag mode-${msg.mode}`}>
                  {msg.mode === 'knowledge_base' ? '社内データで検索' : '通常AIで生成'}
                </span>
              )}
              {msg.model && (
                <span className={`model-tag model-${msg.model}`}>
                  {getModelDisplayName(msg.model)}
                </span>
              )}
            </div>
          )}
          {copiedId === msg.id ? (
            <span className="copied-feedback">コピーしました！</span>
          ) : (
            <button className="action-icon" title="Copy" onClick={() => handleCopy(msg.content, msg.id)}>
              <LuCopy />
            </button>
          )}
        </div>
      </>
    );

    return (
      <div key={msg.id} className={`message-wrapper ${msg.role}`}>
        <div className="message-content-container">{messageContent}</div>
      </div>
    );
  };

  return (
    <>
      <div className="chat-area" ref={chatAreaRef} onScroll={handleScroll}>
        {messages.map(renderMessage)}
      </div>
      
      {showScrollToBottom && (
        <button className="scroll-to-bottom-button" onClick={scrollToBottom} title="一番下へ移動">
          <IoArrowDown />
        </button>
      )}
    </>
  );
};

export default MessageList;