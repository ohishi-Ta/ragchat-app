export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
  model?: 'nova-lite' | 'nova-pro' | 'nova-canvas' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4'| 'gpt-oss-20b'| 'gpt-oss-120b';
  attachment?: {
    fileName: string;
    fileType?: string;
    size?: number;
    s3Key?: string;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

export type ChatMode = 'knowledge_base' | 'general';

export type ModelType = 'nova-lite' | 'nova-pro' | 'nova-canvas' | 'claude-3-7-sonnet' | 'claude-sonnet-4'| 'gpt-oss-20b'| 'gpt-oss-120b';

export type ChatListItem = Omit<ChatThread, 'messages'>;

export interface SSEMessage {
  type: string;
  data: any;
}