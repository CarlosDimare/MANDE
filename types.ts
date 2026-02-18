
import { type Part } from '@google/genai';

export enum AppMode {
  CHAT = 'CHAT',
  IMAGE_GEN = 'IMAGE_GEN',
  LIVE = 'LIVE'
}

export enum ModelId {
  FLASH_2_5 = 'gemini-2.5-flash'
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text?: string;
  images?: string[]; // base64
  videoUri?: string; // (Legacy/External)
  audioData?: string; // base64 for TTS
  toolCalls?: any[];
  grounding?: {
    search?: { uri: string; title: string }[];
    maps?: { uri: string; title: string }[];
  };
  isLoading?: boolean;
  hidden?: boolean; // Nueva propiedad para ocultar el mensaje en el UI
  timestamp: number;
}

export interface AppConfig {
  systemInstruction: string;
  useSearch: boolean;
  useMaps: boolean;
  useThinking: boolean;
  thinkingBudget: number;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
