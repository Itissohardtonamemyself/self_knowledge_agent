import { create } from 'zustand';
import type { ConversationOut, ChatMessage, DocumentOut, UserProfileOut, LongTermMemoryOut, UserOut } from '@/types';
import { setAuthToken, setStoredUser, clearAuth, getStoredUser } from '@/lib/api';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  // Auth
  user: UserOut | null;
  isLoggedIn: boolean;
  setUser: (user: UserOut | null) => void;
  login: (user: UserOut, token: string) => void;
  logout: () => void;

  // UI
  sidebarOpen: boolean;
  toasts: Toast[];
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  pushToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: number) => void;

  // Stats
  stats: {
    documents?: number;
    memories?: number;
    conversations?: number;
    chunks?: number;
  } | null;
  setStats: (s: any) => void;

  // Conversations
  conversations: ConversationOut[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingContent: string;
  streamingPhase: string;
  streamingCitations: any[];
  streamingFollowUps: string[];
  setConversations: (list: ConversationOut[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (patch: Partial<ChatMessage>) => void;
  startStreaming: (msgId: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setStreamingPhase: (p: string) => void;
  setStreamingCitations: (c: any[]) => void;
  setStreamingFollowUps: (q: string[]) => void;
  finishStreaming: () => void;

  // Documents
  documents: DocumentOut[];
  documentTotal: number;
  documentsLoading: boolean;
  setDocuments: (items: DocumentOut[], total: number) => void;
  setDocumentsLoading: (b: boolean) => void;
  upsertDocument: (doc: DocumentOut) => void;
  removeDocument: (id: string) => void;

  // Memory
  profile: UserProfileOut | null;
  memories: LongTermMemoryOut[];
  memoryTotal: number;
  setProfile: (p: UserProfileOut | null) => void;
  setMemories: (list: LongTermMemoryOut[], total: number) => void;
  upsertMemory: (m: LongTermMemoryOut) => void;
  removeMemory: (id: number) => void;
}

let toastSeq = 1;

const storedUser = getStoredUser();

export const useAppStore = create<AppState>((set, get) => ({
  user: storedUser,
  isLoggedIn: !!storedUser,
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  login: (user, token) => {
    setAuthToken(token);
    setStoredUser(user);
    set({ user, isLoggedIn: true });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isLoggedIn: false });
  },

  sidebarOpen: true,
  toasts: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),
  pushToast: (type, message) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  stats: null,
  setStats: (s) => set({ stats: s }),

  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  streamingContent: '',
  streamingPhase: '',
  streamingCitations: [],
  streamingFollowUps: [],
  setConversations: (list) => set({ conversations: list }),
  setActiveConversation: (id) => set({ activeConversationId: id, messages: id ? get().messages : [] }),
  setMessages: (msgs) => set({ messages: msgs }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (patch) =>
    set((s) => {
      if (!s.messages.length) return {};
      const last = s.messages[s.messages.length - 1];
      return {
        messages: [
          ...s.messages.slice(0, -1),
          { ...last, ...patch, content: patch.content ?? last.content } as ChatMessage,
        ],
      };
    }),
  startStreaming: (msgId) =>
    set({
      isStreaming: true,
      streamingMessageId: msgId,
      streamingContent: '',
      streamingPhase: '',
      streamingCitations: [],
      streamingFollowUps: [],
    }),
  appendStreamingContent: (chunk) =>
    set((s) => {
      const nextContent = s.streamingContent + chunk;
      if (!s.messages.length) return { streamingContent: nextContent };
      const last = s.messages[s.messages.length - 1];
      return {
        streamingContent: nextContent,
        messages: [
          ...s.messages.slice(0, -1),
          { ...last, content: nextContent } as ChatMessage,
        ],
      };
    }),
  setStreamingPhase: (p) => set({ streamingPhase: p }),
  setStreamingCitations: (c) =>
    set((s) => {
      if (!s.messages.length) return { streamingCitations: c };
      const last = s.messages[s.messages.length - 1];
      return {
        streamingCitations: c,
        messages: [
          ...s.messages.slice(0, -1),
          { ...last, citations: c } as ChatMessage,
        ],
      };
    }),
  setStreamingFollowUps: (q) =>
    set((s) => {
      if (!s.messages.length) return { streamingFollowUps: q };
      const last = s.messages[s.messages.length - 1];
      return {
        streamingFollowUps: q,
        messages: [
          ...s.messages.slice(0, -1),
          { ...last, follow_ups: q } as ChatMessage,
        ],
      };
    }),
  finishStreaming: () =>
    set({
      isStreaming: false,
      streamingMessageId: null,
      streamingContent: '',
      streamingPhase: '',
    }),

  documents: [],
  documentTotal: 0,
  documentsLoading: false,
  setDocuments: (items, total) => set({ documents: items, documentTotal: total }),
  setDocumentsLoading: (b) => set({ documentsLoading: b }),
  upsertDocument: (doc) =>
    set((s) => {
      const i = s.documents.findIndex((d) => d.id === doc.id);
      if (i >= 0) {
        const arr = s.documents.slice();
        arr[i] = doc;
        return { documents: arr };
      }
      return { documents: [doc, ...s.documents], documentTotal: s.documentTotal + 1 };
    }),
  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      documentTotal: Math.max(0, s.documentTotal - 1),
    })),

  profile: null,
  memories: [],
  memoryTotal: 0,
  setProfile: (p) => set({ profile: p }),
  setMemories: (list, total) => set({ memories: list, memoryTotal: total }),
  upsertMemory: (m) =>
    set((s) => {
      const i = s.memories.findIndex((x) => x.id === m.id);
      if (i >= 0) {
        const arr = s.memories.slice();
        arr[i] = m;
        return { memories: arr };
      }
      return { memories: [m, ...s.memories], memoryTotal: s.memoryTotal + 1 };
    }),
  removeMemory: (id) =>
    set((s) => ({
      memories: s.memories.filter((m) => m.id !== id),
      memoryTotal: Math.max(0, s.memoryTotal - 1),
    })),
}));
