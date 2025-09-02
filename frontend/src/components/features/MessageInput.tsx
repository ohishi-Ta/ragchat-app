import React, { useRef, useState, useEffect } from 'react';
import { LuSendHorizontal, LuPaperclip, LuSquare } from 'react-icons/lu';
import TextareaAutosize from 'react-textarea-autosize';
import type { ChatMode, ModelType } from '../../types/chat';
import type { FileAttachment, UploadProgress } from '../../types/file';
import FilePreview from '../ui/FilePreview';

interface MessageInputProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSendMessage: () => void;
  onStopGeneration?: () => void;
  isLoading: boolean;
  mode: ChatMode;
  model: ModelType;
  onModeChange: (mode: ChatMode) => void;
  attachedFile: FileAttachment | null;
  onFileAttach: (file: File) => void;
  onFileRemove: () => void;
  uploadProgress: UploadProgress;
}

const MessageInput: React.FC<MessageInputProps> = ({
  prompt,
  onPromptChange,
  onSendMessage,
  onStopGeneration,
  isLoading,
  mode,
  model,
  onModeChange,
  attachedFile,
  onFileAttach,
  onFileRemove,
  uploadProgress
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [shouldFocus, setShouldFocus] = useState(false);

  // promptが空になった時にフォーカスを戻す
  useEffect(() => {
    if (shouldFocus && !prompt && !isLoading) {
      promptTextareaRef.current?.focus();
      setShouldFocus(false);
    }
  }, [prompt, isLoading, shouldFocus]);

  // 送信または停止処理
  const handleSendOrStop = () => {
    if (isLoading) {
      // 生成中の場合は停止
      if (onStopGeneration) {
        onStopGeneration();
      }
    } else {
      // 生成中でない場合は送信
      if (uploadProgress.isUploading || (!prompt.trim() && !attachedFile)) return;
      
      setShouldFocus(true);
      onSendMessage();
      
      setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 10);
    }
  };

  // Enterキーでの送信処理（デスクトップのみ）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // スマホ・タブレットではEnterキーでの送信を無効化
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
      e.preventDefault();
      if (!isLoading) {
        handleSendOrStop();
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileAttach(file);
    }
    event.target.value = '';
  };

  return (
    <div className="prompt-input-wrapper">
      {/* モード選択セクション */}
      <div className="mode-selector">
        <label className="radio-label">
          <input 
            type="radio" 
            name="chatMode" 
            value="knowledge_base"
            checked={mode === 'knowledge_base'}
            onChange={() => onModeChange('knowledge_base')}
            disabled={isLoading || !!attachedFile}
          />
          <span>社内データのみ</span>
        </label>
        <label className="radio-label">
          <input 
            type="radio" 
            name="chatMode" 
            value="general"
            checked={mode === 'general'}
            onChange={() => onModeChange('general')}
            disabled={isLoading}
          />
          <span>通常生成AI利用</span>
        </label>
      </div>

      {/* アップロード進捗表示 */}
      {uploadProgress.isUploading && (
        <div className="upload-progress" style={{
          padding: '8px 12px',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '14px', marginBottom: '4px' }}>
            ファイル処理中... {uploadProgress.progress}%
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#ddd',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress.progress}%`,
              height: '100%',
              backgroundColor: '#2196f3',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {uploadProgress.error && (
        <div className="upload-error" style={{
          padding: '8px 12px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          ❌ {uploadProgress.error}
        </div>
      )}

      {/* ファイルプレビュー */}
      {attachedFile && (
        <FilePreview 
          file={attachedFile}
          onRemove={onFileRemove}
        />
      )}

      <div className="prompt-input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/*,application/pdf"
        />
        <button
          className="attach-icon-button"
          onClick={handleAttachClick}
          disabled={isLoading || uploadProgress.isUploading || !!attachedFile || mode !== 'general' || model.includes('gpt-oss')}
          title={
            mode !== 'general' 
              ? "通常生成AI利用モードで添付可能です" 
              : model.includes('gpt-oss')
              ? "gpt-ossモデルではファイル添付できません"
              : uploadProgress.isUploading 
              ? "ファイル処理中です" 
              : "ファイルを添付（画像最大10MB・PDF最大4.5MB）"
          }
        >
          <LuPaperclip />
        </button>
        <TextareaAutosize
          ref={promptTextareaRef}
          className="prompt-textarea"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'knowledge_base' 
              ? "ご自由に入力してください..."
              : attachedFile 
              ? "画像について質問してください..." 
              : "ご自由に入力してください... "
          }
          disabled={isLoading || uploadProgress.isUploading}
          rows={1}
          maxRows={10}
        />
        <button 
          className={`send-icon-button ${isLoading ? 'stop-button' : ''}`}
          onClick={handleSendOrStop}
          disabled={uploadProgress.isUploading || (!isLoading && !prompt.trim() && !attachedFile)}
          title={isLoading ? "生成を停止" : "送信"}
        >
          {isLoading ? <LuSquare /> : <LuSendHorizontal />}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;