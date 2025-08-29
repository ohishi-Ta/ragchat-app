// src/contexts/ImageContext.tsx - コンソールログ削除版
import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { GeneratedImage } from '../types/image';

interface ImageFormState {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number | null;
  numberOfImages: number;
}

interface ImageContextType {
  // 画像状態
  generatedImages: GeneratedImage[];
  setGeneratedImages: (images: GeneratedImage[]) => void;
  clearImages: () => void;
  hasImages: boolean;
  
  // フォーム状態
  formState: ImageFormState;
  updateFormState: (updates: Partial<ImageFormState>) => void;
  clearFormState: () => void;
}

const defaultFormState: ImageFormState = {
  prompt: '',
  negativePrompt: '',
  width: 512,
  height: 512,
  seed: null,
  numberOfImages: 1
};

const ImageContext = createContext<ImageContextType | undefined>(undefined);

interface ImageProviderProps {
  children: ReactNode;
}

export const ImageProvider: React.FC<ImageProviderProps> = ({ children }) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [formState, setFormState] = useState<ImageFormState>(defaultFormState);

  const clearImages = () => {
    setGeneratedImages([]);
  };

  const updateFormState = (updates: Partial<ImageFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  const clearFormState = () => {
    setFormState(defaultFormState);
  };

  const contextValue: ImageContextType = {
    generatedImages,
    setGeneratedImages,
    clearImages,
    hasImages: generatedImages.length > 0,
    formState,
    updateFormState,
    clearFormState
  };

  return (
    <ImageContext.Provider value={contextValue}>
      {children}
    </ImageContext.Provider>
  );
};

// 基本的なuseContextを使用
export const useImageContext = (): ImageContextType => {
  const context = useContext(ImageContext);
  
  if (context === undefined) {
    throw new Error('useImageContext must be used within an ImageProvider');
  }
  
  return context;
};