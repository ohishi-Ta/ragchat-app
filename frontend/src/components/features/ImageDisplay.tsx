// src/components/features/ImageDisplay.tsx - クリーンアップ版

import React from 'react';
import { LuDownload, LuRefreshCw } from 'react-icons/lu';
import type { GeneratedImage } from '../../types/image';

interface ImageDisplayProps {
  image: GeneratedImage;
  onRegenerate?: (seed: number) => void;
  className?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({
  image,
  onRegenerate,
  className = ''
}) => {
  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image.base64}`;
      
      const filename = `generated_${image.seed}_${new Date().getTime()}.png`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      alert('ダウンロードに失敗しました');
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(image.seed);
    }
  };

  return (
    <div className={`image-display ${className}`}>
      {/* 画像本体 */}
      <div className="image-container">
        <img
          src={`data:image/png;base64,${image.base64}`}
          alt={image.prompt}
          className="generated-image"
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        />
        
        {/* オーバーレイアクション */}
        <div className="image-overlay">
          <div className="image-actions">
            <button
              onClick={handleDownload}
              className="action-button download"
              title="ダウンロード"
            >
              <LuDownload />
            </button>
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                className="action-button regenerate"
                title="同じシードで再生成"
              >
                <LuRefreshCw />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 簡潔な画像情報 */}
      <div className="image-simple-info" style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>シード:</strong> {image.seed}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>サイズ:</strong> {image.width} × {image.height}
        </div>
        <div>
          <strong>生成日時:</strong> {new Date(image.generatedAt).toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  );
};

export default ImageDisplay;