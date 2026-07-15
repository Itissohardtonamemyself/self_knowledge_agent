import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Send,
  Search,
  Sparkles,
  Paperclip,
  Loader2,
  FileText,
  Brain,
  Lightbulb,
  ChevronDown,
  MessageSquare,
  Menu,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { ChatMessage, Citation, ConversationOut } from '@/types';

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Chat() {
  const nav = useNavigate();
  const params = useParams<{ conversationId?: string }>();
  const push = useAppStore((s) => s.pushToast);

  const conversations = useAppStore((s) => s.conversations);
  const setConversations = useAppStore((s) => s.setConversations);
  const activeId = useAppStore((s) => s.activeConversationId);
  const setActiveId = useAppStore((s) => s.setActiveConversation);
  const messages = useAppStore((s) => s.messages);
  const setMessages = useAppStore((s) => s.setMessages);
  const appendMessage = useAppStore((s) => s.appendMessage);
  const startStreaming = useAppStore((s) => s.startStreaming);
  const appendStreamingContent = useAppStore((s) => s.appendStreamingContent);
  const setStreamingPhase = useAppStore((s) => s.setStreamingPhase);
  const setStreamingCitations = useAppStore((s) => s.setStreamingCitations);
  const setStreamingFollowUps = useAppStore((s) => s.setStreamingFollowUps);
  const finishStreaming = useAppStore((s) => s.finishStreaming);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const streamingPhase = useAppStore((s) => s.streamingPhase);

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [query, setQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const filteredConvs = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listConversations(1, 50);
        const list: ConversationOut[] = res.items ?? res.data ?? res ?? [];
        setConversations(Array.isArray(list) ? list : []);
      } catch (e: any) {
        // 忽略
      }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    const id = params.conversationId;
    if (id && id !== activeId) {
      setActiveId(id);
      (async () => {
        try {
          const res = await api.listMessages(id, 1, 500);
          const list: ChatMessage[] = res.items ?? res.data ?? res ?? [];
          setMessages(Array.isArray(list) ? list : []);
        } catch (e: any) {
          push('error', '加载会话失败');
        }
      })();
    }
    if (!id && activeId) {
      setActiveId(null);
      setMessages([]);
    }
    // eslint-disable-next-line
  }, [params.conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const startNewConv = async () => {
    try {
      const res = await api.createConversation({ title: '新对话' });
      const conv: ConversationOut = res;
      setConversations([conv, ...conversations]);
      nav(`/chat/${conv.id}`);
    } catch (e: any) {
      push('error', e.message || '创建会话失败');
    }
  };

  const deleteConv = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('删除此会话？')) return;
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter((c) => c.id !== id));
      if (id === activeId) nav('/chat');
    } catch (e: any) {
      push('error', e.message || '删除失败');
    }
  };

  const submit = async () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput('');
    let cid = activeId;
    if (!cid) {
      try {
        const res = await api.createConversation({ title: q.slice(0, 24) });
        cid = res.id;
        setConversations([res, ...conversations]);
        nav(`/chat/${cid}`, { replace: true });
        setActiveId(cid);
      } catch (e: any) {
        push('error', e.message || '创建会话失败');
        return;
      }
    }

    appendMessage({
      id: 'u-' + Date.now(),
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    });
    const aid = 'a-' + Date.now();
    appendMessage({
      id: aid,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      citations: [],
    });
    startStreaming(aid);

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/api/v1/ws/chat`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ conversation_id: cid, query: q, stream: true, use_memory: true }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const type = msg.type;
          const data = msg.data ?? {};
          if (type === 'chat.phase') {
            setStreamingPhase(typeof data === 'string' ? data : data.phase || '');
          } else if (type === 'search.results') {
            // ignore
          } else if (type === 'chat.token') {
            appendStreamingContent(typeof data === 'string' ? data : data.token || data.content || '');
          } else if (type === 'citations') {
            setStreamingCitations(Array.isArray(data) ? data : data.citations ?? []);
          } else if (type === 'follow_ups') {
            setStreamingFollowUps(Array.isArray(data) ? data : []);
          } else if (type === 'chat.done') {
            setStreamingPhase('');
            finishStreaming();
            ws.close();
          } else if (type === 'error') {
            push('error', data.message || '对话错误');
            finishStreaming();
            ws.close();
          }
        } catch {}
      };
      ws.onerror = () => {
        push('error', 'WebSocket 连接失败，尝试同步请求');
        // fallback sync
        (async () => {
          try {
            const resp = await api.chat({ conversation_id: cid, query: q, use_memory: true });
            appendStreamingContent(resp.answer || '');
            if (resp.citations) setStreamingCitations(resp.citations);
            if (resp.follow_up_questions) setStreamingFollowUps(resp.follow_up_questions);
          } catch (e2: any) {
            push('error', e2.message || '请求失败');
          } finally {
            finishStreaming();
          }
        })();
      };
      ws.onclose = () => {
        if (isStreaming) finishStreaming();
      };
    } catch (e: any) {
      push('error', e.message || '连接失败');
      finishStreaming();
    }
  };

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const phaseLabel: Record<string, string> = {
    retrieve: '🔎 正在检索相关知识…',
    rewrite: '✍️ 优化你的问题…',
    reason: '🧠 正在组织答案…',
    generate: '✨ 生成回复中…',
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] min-h-[600px]">
      <div className={`${showSidebar ? 'w-72' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden`}>
        <div className="w-72 h-full card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <button onClick={startNewConv} className="btn-primary w-full !py-2.5">
              <Plus className="w-4 h-4" /> 新建对话
            </button>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input !pl-9 !py-2"
                placeholder="搜索对话历史…"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConvs.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                暂无对话记录
              </div>
            )}
            {filteredConvs.map((c) => (
              <div
                key={c.id}
                onClick={() => nav(`/chat/${c.id}`)}
                className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                  c.id === activeId
                    ? 'bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-800 truncate">{c.title || '未命名'}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{c.message_count ?? 0} 条消息</span>
                      <span>·</span>
                      <span>{formatDate(c.updated_at || c.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConv(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 card flex flex-col overflow-hidden">
        <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-500" />
                {activeId ? '对话中' : '开启新对话'}
              </div>
              {isStreaming && streamingPhase && (
                <div className="text-xs text-primary-600 mt-0.5 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {phaseLabel[streamingPhase] || streamingPhase}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center mb-5">
                <Sparkles className="w-10 h-10 text-primary-600" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-slate-800 mb-2">你好，我是你的知识伙伴</h2>
              <p className="text-sm text-slate-500 max-w-md">
                基于你上传的文档和记录的记忆，我可以帮你检索、总结、推理。
                有什么想了解的吗？
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
                {[
                  '总结我上传的所有文档要点',
                  '关于 [某个主题] 我都保存了什么？',
                  '帮我整理 [主题] 的时间线',
                  '对比 A 和 B 的差异',
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-left p-3 rounded-xl2 bg-slate-50 hover:bg-primary-50 border border-slate-100 hover:border-primary-200 text-sm text-slate-700 transition"
                  >
                    💭 {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 lg:p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-4xl mx-auto">
            <div className="card p-2 shadow-sm flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary-200 transition">
              <button className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition" title="附件（暂未）">
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="输入问题，Shift+Enter 换行，Enter 发送…"
                className="flex-1 resize-none border-0 outline-none bg-transparent text-sm py-2 px-1 max-h-40 placeholder:text-slate-400"
              />
              <button
                onClick={submit}
                disabled={!input.trim() || isStreaming}
                className="btn-primary !p-2.5 !px-3"
              >
                {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-[11px] text-center text-slate-400 mt-2">
              回答由检索 + 大模型生成，请勿用于重要决策 · 请核对引用来源
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [showCites, setShowCites] = useState(true);
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-tr-md'
              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          ) : (
            <div className="markdown-body">
              {msg.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="w-1.5 h-4 bg-primary-500 rounded-sm animate-typing" />
                  <span className="w-1.5 h-4 bg-primary-400 rounded-sm animate-typing" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-4 bg-primary-300 rounded-sm animate-typing" style={{ animationDelay: '0.3s' }} />
                </span>
              )}
            </div>
          )}
        </div>

        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setShowCites(!showCites)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-600 mb-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              引用来源 {msg.citations.length} 条
              <ChevronDown className={`w-3.5 h-3.5 transition ${showCites ? 'rotate-180' : ''}`} />
            </button>
            {showCites && <Citations cites={msg.citations} />}
          </div>
        )}

        {!isUser && msg.follow_ups && msg.follow_ups.length > 0 && (
          <div className="mt-2 w-full space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
              <Lightbulb className="w-3 h-3 text-accent-500" />
              建议继续追问
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.follow_ups.map((q) => (
                <button
                  key={q}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-accent-50 text-accent-700 hover:bg-accent-100 border border-accent-200 transition max-w-xs truncate"
                  onClick={() => {
                    const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
                    if (ta) { ta.value = q; ta.dispatchEvent(new Event('input', { bubbles: true })); }
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`text-[10px] text-slate-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatDate(msg.created_at)}
        </div>
      </div>
    </div>
  );
}

function Citations({ cites }: { cites: Citation[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {cites.map((c, i) => {
        const isDoc = c.type !== 'memory';
        const Icon = isDoc ? FileText : Brain;
        const pct = Math.max(0, Math.min(100, Math.round((c.score ?? 0) * 100)));
        return (
          <div key={i} className="rounded-xl p-3 border border-slate-100 bg-slate-50/80 hover:bg-white hover:border-primary-200 transition">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold ${isDoc ? 'bg-primary-500' : 'bg-accent-500'}`}>
                {i + 1}
              </span>
              <Icon className={`w-3.5 h-3.5 ${isDoc ? 'text-primary-600' : 'text-accent-600'}`} />
              <span className="text-xs font-medium text-slate-700 truncate flex-1" title={c.source_title}>
                {c.source_title || (isDoc ? '文档片段' : '长期记忆')}
              </span>
              {typeof c.score === 'number' && (
                <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
              )}
            </div>
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{c.content}</p>
            {typeof c.score === 'number' && (
              <div className="mt-2 h-1 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${isDoc ? 'bg-primary-500' : 'bg-accent-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
