// src/components/features/MultiImageDisplay.tsx - CSS Classes版

import React, { useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import type { GeneratedImage } from '../../types/image';

interface MultiImageDisplayProps {
  images: GeneratedImage[];
  onRegenerate?: (seed: number) => void;
  className?: string;
}

const MultiImageDisplay: React.FC<MultiImageDisplayProps> = ({
  images,
  className = ''
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  // 個別画像ダウンロード
  const downloadImage = (image: GeneratedImage, index?: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image.base64}`;
    const filename = `nova_canvas_${image.seed}${index !== undefined ? `_${index + 1}` : ''}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (images.length === 1) {
    const image = images[0];
    
    return (
      <div className={`single-image-display ${className}`}>
        <div className="main-image-container">
          <img
            src={`data:image/png;base64,${image.base64}`}
            alt={image.prompt}
            className="main-generated-image"
          />
          
          <button
            onClick={() => downloadImage(image)}
            className="download-button-overlay"
            title="ダウンロード"
          >
            <LuDownload />
          </button>
        </div>
        
        <div className="image-simple-info">
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
  }

  const selectedImage = images[selectedImageIndex];

  return (
    <div className={`multi-image-display ${className}`}>
      {/* メイン画像表示 */}
      <div className="main-image-container">
        <img
          src={`data:image/png;base64,${selectedImage.base64}`}
          alt={`${selectedImage.prompt} - ${selectedImageIndex + 1}`}
          className="main-generated-image"
        />
        
        <button
          onClick={() => downloadImage(selectedImage, selectedImageIndex)}
          className="download-button-overlay"
          title="この画像をダウンロード"
        >
          <LuDownload />
        </button>
      </div>

      {/* サムネイル一覧 */}
      <div className="thumbnail-container">
        {images.map((image, index) => (
          <div 
            key={index}
            className={`thumbnail-item ${index === selectedImageIndex ? 'active' : ''}`}
            onClick={() => handleThumbnailClick(index)}
          >
            <img
              src={`data:image/png;base64,${image.base64}`}
              alt={`${image.prompt} - ${index + 1}`}
              className="thumbnail-image"
            />
          </div>
        ))}
      </div>

      {/* 簡潔な画像詳細情報 */}
      <div className="image-simple-info">
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
          画像 {selectedImageIndex + 1} / {images.length}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>シード:</strong> {selectedImage.seed}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>サイズ:</strong> {selectedImage.width} × {selectedImage.height}
        </div>
        <div>
          <strong>生成日時:</strong> {new Date(selectedImage.generatedAt).toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  );
};

export default MultiImageDisplay;