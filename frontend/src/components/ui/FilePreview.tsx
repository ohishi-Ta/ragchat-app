import React from 'react';
import { LuX } from 'react-icons/lu';
import { IoDocumentTextOutline } from 'react-icons/io5';
import type { FileAttachment } from '../../types/file';

interface FilePreviewProps {
  file: FileAttachment;
  onRemove: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove }) => {
  return (
    <div className="file-preview-container">
      <div className="file-preview">
        <div className="file-preview-icon">
          <IoDocumentTextOutline />
        </div>
        <span className="file-preview-name">
          {file.fileName}
          {file.size && ` (${Math.round(file.size / 1024)}KB)`}
        </span>
        <button 
          className="file-preview-remove" 
          onClick={onRemove} 
          title="ファイルを削除"
        >
          <LuX />
        </button>
      </div>
    </div>
  );
};

export default FilePreview;