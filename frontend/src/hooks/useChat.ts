// src/hooks/useChat.ts - 回答完了後サイドバー追加版

import { useState, useEffect, useRef } from 'react';
import type { ChatThread, Message, SSEMessage, ChatListItem, ModelType, ChatMode } from '../types/chat';
import type { FileAttachment } from '../types/file';
import { chatApi } from '../services/chatApi';

export const useChat = (user: any) => {
  const [chats, setChats] = useState<ChatThread[]>([]); // サイドバー用チャット一覧
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]); // 表示用メッセージ（分離）
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamingMessageIdRef = useRef<string | null>(null);

  // 一意のIDを生成する関数
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // チャット履歴取得
  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const fetchChatList = async () => {
      try {
        const data: ChatListItem[] = await chatApi.fetchChatList();
        setChats(data.map(chat => ({ ...chat, messages: [] })));
      } catch (error) {
        console.error("チャット履歴一覧の取得に失敗しました:", error);
      }
    };

    fetchChatList();
  }, [user]);

  // 履歴取得関数（簡素化）
  const fetchChatHistory = async (chatId: string) => {
    try {
      const messages: Message[] = await chatApi.fetchChatHistory(chatId);
      
      // サイドバーのchatsではなく、activeMessagesに直接設定
      setActiveMessages(messages);
      
    } catch (error) {
      console.error("チャット履歴の取得に失敗しました:", error);
    }
  };

  // アクティブチャット変更時の履歴取得
  useEffect(() => {
    if (activeChatId && !activeChatId.startsWith('streaming-')) {
      // 正式なチャットIDの場合のみ履歴取得
      fetchChatHistory(activeChatId);
    } else if (activeChatId && activeChatId.startsWith('streaming-')) {
      // 新規チャット（streaming）の場合は既にactiveMessagesに設定済み
    } else {
      // activeChatId がnullの場合はメッセージをクリア
      setActiveMessages([]);
    }
  }, [activeChatId]); // chatsを依存配列から削除

  // チャット削除ハンドラー
  const handleChatDelete = async (chatId: string) => {
    if (isDeletingChat) return;
    
    setIsDeletingChat(true);
    
    try {
      const success = await chatApi.deleteChat(chatId);
      
      if (success) {
        // ローカル状態から削除
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        
        // 削除されたチャットがアクティブだった場合、アクティブチャットをクリア
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setActiveMessages([]); // activeMessagesもクリア
        }
      } else {
        alert('チャットの削除に失敗しました。');
      }
    } catch (error) {
      console.error('チャット削除エラー:', error);
      alert('チャットの削除中にエラーが発生しました。');
    } finally {
      setIsDeletingChat(false);
    }
  };

  // 停止機能
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      
      // 停止メッセージを追加
      if (currentStreamingMessageIdRef.current) {
        setActiveMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === currentStreamingMessageIdRef.current && msg.role === 'assistant'
              ? { ...msg, content: msg.content + '\n\n[生成が停止されました]' }
              : msg
          )
        );
      }
      
      abortControllerRef.current = null;
      currentStreamingMessageIdRef.current = null;
    }
  };

  // メッセージ送信処理
  const handleSendMessage = async (
    prompt: string,
    mode: ChatMode,
    model: ModelType,
    attachedFile: FileAttachment | null
  ) => {
    if ((!prompt.trim() && !attachedFile)) {
      alert("メッセージを入力するか、ファイルを添付してください。");
      return;
    }

    setIsLoading(true);
    const userMessageContent = prompt;
    const currentFile = attachedFile;

    // 事前に一意のメッセージIDを生成
    const userMessageId = generateUniqueId();
    const assistantMessageId = generateUniqueId();

    // 現在のストリーミング情報を保存
    currentStreamingMessageIdRef.current = assistantMessageId;

    // Lambda関数用の添付ファイルペイロード（S3キー含む）
    let attachmentPayload = null;
    if (currentFile) {
      if (currentFile.fileType === 'application/pdf') {
        attachmentPayload = {
          fileName: currentFile.fileName,
          size: currentFile.size,
          s3Key: currentFile.s3Key,
          source: {
            type: 'document',
            media_type: currentFile.fileType,
            data: currentFile.data,
          },
        };
      } else if (currentFile.fileType.startsWith('image/')) {
        attachmentPayload = {
          fileName: currentFile.fileName,
          size: currentFile.size,
          s3Key: currentFile.s3Key,
          source: {
            type: 'image',
            media_type: currentFile.fileType,
            data: currentFile.data,
          },
        };
      } else {
        throw new Error('サポートされていないファイル形式です');
      }
    }

    // ユーザーメッセージ（簡素化）
    const userMessage: Message = { 
      id: userMessageId,
      role: 'user', 
      content: userMessageContent,
      attachment: currentFile ? {
        fileName: currentFile.fileName,
        fileType: currentFile.fileType,
        size: currentFile.size,
        s3Key: currentFile.s3Key
      } : undefined
    };

    const assistantPlaceholder: Message = { 
      id: assistantMessageId,
      role: 'assistant', 
      content: '',
      mode: mode,
      model: model
    };

    const isNewChat = activeChatId === null;
    let chatTitle = userMessageContent.substring(0, 30);
    if (!chatTitle && currentFile) {
      chatTitle = currentFile.fileName;
    }

    if (isNewChat) {
      // 🎯 新規チャットの場合、activeMessagesに直接設定（サイドバーには追加しない）
      const tempChatId = `streaming-${userMessageId}`;
      setActiveChatId(tempChatId);
      setActiveMessages([userMessage, assistantPlaceholder]);
      
    } else {
      // 既存チャットの場合、activeMessagesに追加
      setActiveMessages(prev => {
        // 既存のメッセージIDと重複しないかチェック
        const existingIds = prev.map(msg => msg.id);
        if (existingIds.includes(userMessageId) || existingIds.includes(assistantMessageId)) {
          return prev;
        }
        
        return [...prev, userMessage, assistantPlaceholder];
      });
    }

    // AbortController管理
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await chatApi.sendMessage({
        user_prompt: userMessageContent,
        chat_id: isNewChat ? null : activeChatId,
        mode: mode,
        model: model,
        attachment: attachmentPayload,
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        signal: abortControllerRef.current.signal,
      });

      // SSEストリーム処理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ストリームの読み取りができませんでした');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const jsonData = line.slice(6).trim();
              if (jsonData === '') continue;
              
              try {
                const message: SSEMessage = JSON.parse(jsonData);
                
                if (message.type === 'message') {
                  // activeMessagesを直接更新
                  setActiveMessages(prevMessages => {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    if (lastMessage?.role === 'assistant' && lastMessage?.id === assistantMessageId) {
                      const updatedLastMessage = { 
                        ...lastMessage, 
                        content: lastMessage.content + message.data 
                      };
                      return [...prevMessages.slice(0, -1), updatedLastMessage];
                    }
                    return prevMessages;
                  });
                }
              } catch (e) {
                console.error("SSEメッセージの解析に失敗しました:", e);
              }
            } else if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              
              const nextLineIndex = lines.indexOf(line) + 1;
              if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('data: ')) {
                const eventData = lines[nextLineIndex].slice(6).trim();
                
                try {
                  if (eventType === 'newChat') {
                    const newChatData = JSON.parse(eventData);
                    
                    if (isNewChat) {
                      // 🎯 サイドバーに正式なチャットを追加
                      setChats(prev => [newChatData, ...prev]);
                      
                      // activeChatIdを正式なIDに変更
                      setActiveChatId(newChatData.id);
                      
                      // activeMessagesは既に設定済みなのでそのまま
                    }
                  } else if (eventType === 'error') {
                    const errorData = JSON.parse(eventData);
                    console.error("サーバーエラー:", errorData);
                    setIsLoading(false);
                  } else if (eventType === 'end') {
                    setIsLoading(false);
                    if (activeChatId) {
                      setActiveChatId(activeChatId);
                    }
                  }
                } catch (e) {
                  console.error("イベント処理エラー:", e);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        setIsLoading(false);
        abortControllerRef.current = null;
        currentStreamingMessageIdRef.current = null;
      }

    } catch (error) {
      setIsLoading(false);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error("SSEリクエストエラー:", error);
      
      if (activeChatId) {
        setActiveChatId(activeChatId);
      }
      
      currentStreamingMessageIdRef.current = null;
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setActiveMessages([]);
    
    // 進行中の生成があれば停止
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      abortControllerRef.current = null;
      currentStreamingMessageIdRef.current = null;
    }
  };

  const handleChatSelect = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
      // activeMessagesは useEffect で自動更新される
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    chats,
    activeChatId,
    activeMessages, // 分離されたactiveMessages
    isLoading,
    isDeletingChat,
    startNewChat,
    handleChatSelect,
    handleChatDelete,
    handleSendMessage,
    handleStopGeneration
  };
};