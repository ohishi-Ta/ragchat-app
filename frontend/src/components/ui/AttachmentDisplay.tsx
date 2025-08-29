// src/components/ui/AttachmentDisplay.tsx - PresignedOnlyImage対応版
import React from 'react';
import { IoDocumentTextOutline } from 'react-icons/io5';
import type { Message } from '../../types/chat';
import PresignedOnlyImage from './PresignedOnlyImage';

interface AttachmentDisplayProps {
  attachment: Message['attachment'];
}

const AttachmentDisplay: React.FC<AttachmentDisplayProps> = ({ attachment }) => {
  if (!attachment) return null;

  // fileTypeの安全チェック
  const fileType = attachment.fileType || '';
  const fileName = attachment.fileName || 'Unknown file';
  
  if (fileType.startsWith('image/')) {
    // 🎯 PresignedOnlyImageを使用（大幅簡素化）
    return (
      <PresignedOnlyImage
        s3Key={attachment.s3Key}
        mimeType={fileType}
        fileName={fileName}
        size={attachment.size}
      />
    );
  } else {
    // その他のファイル（PDF等）の場合
    return (
      <div className="attachment-file" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        maxWidth: '300px'
      }}>
        <div className="attachment-file-icon" style={{ fontSize: '24px', marginRight: '12px' }}>
          <IoDocumentTextOutline />
        </div>
        <div>
          <div className="attachment-file-name" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {fileName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
          </div>
        </div>
      </div>
    );
  }
};

export default AttachmentDisplay;