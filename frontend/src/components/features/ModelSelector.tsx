import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuChevronDown } from 'react-icons/lu';
import type { ModelType } from '../../types/chat';
import { MODEL_OPTIONS, getModelDisplayName, getModelDescription } from '../../constants/models';

interface ModelSelectorProps {
  model: ModelType;
  onModelChange: (newModel: ModelType) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ model, onModelChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (selectedModel: string) => {
    // Nova Canvasが選択された場合は画像生成ページへ遷移
    if (selectedModel === 'nova-canvas') {
      setIsOpen(false);
      navigate('/image');
    }
    
    // 通常のモデル選択
    onModelChange(selectedModel as ModelType);
    setIsOpen(false);
  };

  return (
    <div className="model-selector-dropdown" ref={selectRef}>
      <div className="custom-select">
        <div 
          className="custom-select-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="selected-model">
            <div className="selected-model-name">{getModelDisplayName(model)}</div>
            <div className="selected-model-description">{getModelDescription(model)}</div>
          </div>
          <LuChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
        </div>
        
        {isOpen && (
          <div className="custom-select-dropdown">
            {MODEL_OPTIONS.map((group) => (
              <div key={group.group} className="option-group">
                <div className="option-group-label">{group.group}</div>
                {group.models.map((modelId) => (
                  <div
                    key={modelId}
                    className={`option-item ${model === modelId ? 'selected' : ''} ${modelId === 'nova-canvas' ? 'nova-canvas-option' : ''}`}
                    onClick={() => handleOptionClick(modelId)}
                  >
                    <div className="option-name">{getModelDisplayName(modelId)}</div>
                    <div className="option-description">{getModelDescription(modelId)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;