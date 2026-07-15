import type { ApiResponse } from '@/types';

const API_BASE = '/api/v1';
const STORAGE_KEY_TOKEN = 'ska_auth_token';
const STORAGE_KEY_USER = 'ska_auth_user';

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
}

export function getStoredUser(): any | null {
  const stored = localStorage.getItem(STORAGE_KEY_USER);
  return stored ? JSON.parse(stored) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const token = getAuthToken();
  
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    const text = await res.text();
    let payload: ApiResponse<T>;
    
    try {
      payload = text ? JSON.parse(text) : ({ code: 'EMPTY', message: '', data: null as any });
    } catch {
      throw new ApiError('PARSE_ERROR', `响应解析失败: ${text.slice(0, 200)}`);
    }
    
    if (!res.ok || (payload.code && payload.code !== 'SUCCESS')) {
      const apiError = new ApiError(
        payload.code || `HTTP_${res.status}`,
        payload.message || `请求失败 (HTTP ${res.status})`,
      );
      (apiError as any).status = res.status;
      throw apiError;
    }
    
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  // ============ Auth ============
  login: (payload: { username_or_email_or_phone: string; password: string }) =>
    request<any>('/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload: { username: string; password: string; phone?: string; email?: string; name?: string }) =>
    request<any>('/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<any>('/logout', { method: 'POST' }),
  getUserDetail: () => request<any>('/me'),
  updateUser: (payload: { username?: string; email?: string; phone?: string; name?: string }) =>
    request<any>('/user', { method: 'PUT', body: JSON.stringify(payload) }),

  // ============ System ============
  health: () => request<any>('/health'),

  // ============ Documents ============
  getSupportedExtensions: () => request<string[]>('/documents/supported-extensions'),
  listDocuments: (params: {
    keyword?: string; file_type?: string; status?: string; page?: number; page_size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
    });
    return request<any>(`/documents?${q.toString()}`);
  },
  getDocument: (id: string) => request<any>(`/documents/${id}`),
  uploadDocument: (file: File, tags?: string[]) => {
    const fd = new FormData();
    fd.append('file', file);
    if (tags && tags.length) fd.append('tags', tags.join(','));
    return request<any>('/documents/upload', { method: 'POST', body: fd }, 5 * 60000);
  },
  importUrl: (payload: { url: string; title?: string; tags?: string[] }) =>
    request<any>('/documents/import-url', { method: 'POST', body: JSON.stringify(payload) }),
  updateDocument: (id: string, update: any) =>
    request<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(update) }),
  deleteDocument: (id: string) =>
    request<any>(`/documents/${id}`, { method: 'DELETE' }),

  // ============ Processing ============
  reindexDocument: (id: string) =>
    request<any>(`/processing/reindex/${id}`, { method: 'POST' }),
  reindexAll: (incremental = true) =>
    request<any>(`/processing/reindex-all?incremental=${incremental}`, { method: 'POST' }, 10 * 60000),

  // ============ Interaction ============
  listConversations: (page = 1, page_size = 20) =>
    request<any>(`/conversations?page=${page}&page_size=${page_size}`),
  createConversation: (payload: { title?: string }) =>
    request<any>('/conversations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteConversation: (id: string) =>
    request<any>(`/conversations/${id}`, { method: 'DELETE' }),
  listMessages: (convId: string, page = 1, page_size = 200) =>
    request<any>(`/conversations/${convId}/messages?page=${page}&page_size=${page_size}`),
  chat: (payload: any) =>
    request<any>('/chat', { method: 'POST', body: JSON.stringify(payload) }, 5 * 60000),
  search: (payload: any) =>
    request<any>('/search', { method: 'POST', body: JSON.stringify(payload) }),

  // ============ Memory ============
  getProfile: () => request<any>('/memory/profile'),
  updateProfile: (update: any) =>
    request<any>('/memory/profile', { method: 'PUT', body: JSON.stringify(update) }),
  createLongTermMemory: (payload: any) =>
    request<any>('/memory/long-term', { method: 'POST', body: JSON.stringify(payload) }),
  listLongTermMemories: (params: {
    keyword?: string; status?: string; page?: number; page_size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
    });
    return request<any>(`/memory/long-term?${q.toString()}`);
  },
  deleteLongTermMemory: (id: number) =>
    request<any>(`/memory/long-term/${id}`, { method: 'DELETE' }),

  // ============ Maintenance ============
  maintenanceHealthCheck: () =>
    request<any>('/maintenance/health-check', { method: 'POST' }, 2 * 60000),
  createBackup: (backup_dir?: string) =>
    request<any>(`/maintenance/backup${backup_dir ? `?backup_dir=${encodeURIComponent(backup_dir)}` : ''}`, {
      method: 'POST',
    }, 5 * 60000),
  restoreBackup: (backup_path: string, overwrite = true) => {
    const q = new URLSearchParams({ backup_path, overwrite: String(overwrite) });
    return request<any>(`/maintenance/restore?${q.toString()}`, { method: 'POST' }, 10 * 60000);
  },

  // ============ Privacy ============
  exportAll: (export_dir?: string) =>
    request<any>(`/privacy/export${export_dir ? `?export_dir=${encodeURIComponent(export_dir)}` : ''}`, {
      method: 'POST',
    }, 5 * 60000),
  downloadExport: (file_path: string) =>
    `/api/v1/privacy/download-export?file_path=${encodeURIComponent(file_path)}`,
  wipeAll: (confirm = true) =>
    request<any>(`/privacy/wipe?confirm=${confirm}`, { method: 'POST' }, 5 * 60000),
  maskText: (text: string) => {
    const q = new URLSearchParams({ text });
    return request<any>(`/privacy/mask?${q.toString()}`, { method: 'POST' });
  },
};

export { ApiError };
