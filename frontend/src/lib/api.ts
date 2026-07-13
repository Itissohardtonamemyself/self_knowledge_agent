import type { ApiResponse } from '@/types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
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
      throw new ApiError(
        payload.code || `HTTP_${res.status}`,
        payload.message || `请求失败 (HTTP ${res.status})`,
      );
    }
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
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
