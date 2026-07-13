export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  stats?: Record<string, any>;
}

export interface DocumentOut {
  id: string;
  title: string;
  file_type: string;
  source: 'upload' | 'url';
  source_url?: string;
  file_size?: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  tags: string[];
  description?: string;
  chunk_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadResponse {
  id: string;
  status: string;
  message?: string;
}

export interface DocumentUpdate {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface ConversationOut {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationCreate {
  title?: string;
}

export interface Citation {
  type: 'document' | 'memory';
  source_id: string;
  source_title?: string;
  content: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  citations?: Citation[];
  follow_ups?: string[];
  phase?: string;
}

export interface ChatRequest {
  conversation_id?: string;
  query: string;
  stream?: boolean;
  use_memory?: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  answer: string;
  citations: Citation[];
  follow_up_questions?: string[];
}

export interface SearchHit {
  id: string;
  type: 'document' | 'memory';
  title: string;
  content: string;
  score: number;
  source_id?: string;
}

export interface UserProfileOut {
  id: number;
  name?: string;
  occupation?: string;
  interests?: string[];
  learning_style?: string;
  background?: string;
  preferences?: Record<string, any>;
  updated_at: string;
}

export interface UserProfileUpdate {
  name?: string;
  occupation?: string;
  interests?: string[];
  learning_style?: string;
  background?: string;
  preferences?: Record<string, any>;
}

export interface LongTermMemoryOut {
  id: number;
  content: string;
  tags: string[];
  importance: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface LongTermMemoryCreate {
  content: string;
  tags?: string[];
  importance?: number;
}

export interface BackupResult {
  backup_path?: string;
  size_bytes?: number;
  created_at?: string;
  files?: string[];
  message?: string;
}

export interface ExportResult {
  export_path?: string;
  size_bytes?: number;
  files?: string[];
  created_at?: string;
  message?: string;
}

export interface WsEvent {
  type: 'chat.phase' | 'search.results' | 'chat.token' | 'citations' | 'follow_ups' | 'chat.done' | 'error';
  data: any;
}
