export const MODEL_OPTIONS = [
  { group: 'Amazon Nova', models: ['nova-lite', 'nova-pro', 'nova-canvas'] },
  { group: 'Anthropic Claude', models: ['claude-3-7-sonnet', 'claude-sonnet-4'] },
  { group: 'OpenAI', models: ['gpt-oss-20b', 'gpt-oss-120b'] }
] as const;

export const getModelDisplayName = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return 'Nova Lite';
    case 'nova-pro': return 'Nova Pro';
    case 'nova-canvas': return 'Nova Canvas';
    case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
    case 'claude-sonnet-4': return 'Claude Sonnet 4';
    case 'gpt-oss-20b': return 'gpt-oss-20b';
    case 'gpt-oss-120b': return 'gpt-oss-120b';
    default: return modelId;
  }
};

export const getModelDescription = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return '低コスト、日常的なタスク';
    case 'nova-pro': return '低コスト、複雑な推論タスク';
    case 'nova-canvas': return '画像生成';
    case 'claude-3-7-sonnet': return '中コスト、高度な推論能力';
    case 'claude-sonnet-4': return '高コスト、最上位モデル';
    case 'gpt-oss-20b': return '低コスト、日常的なタスク';
    case 'gpt-oss-120b': return '低コスト、複雑な推論タスク';
    default: return '';
  }
};