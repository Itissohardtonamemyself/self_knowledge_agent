import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  MessageSquarePlus,
  FileText,
  Brain,
  MessageCircle,
  Activity,
  ArrowRight,
  Sparkles,
  FolderPlus,
  DatabaseZap,
  FileOutput,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';

export default function Dashboard() {
  const nav = useNavigate();
  const push = useAppStore((s) => s.pushToast);
  const stats = useAppStore((s) => s.stats);
  const setStats = useAppStore((s) => s.setStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.health();
        setStats(res.stats || {});
      } catch (e: any) {
        push('error', '无法连接后端服务，请确保 FastAPI 已启动 (127.0.0.1:8000)');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  const pick = (a: any, b: any) => {
    const n = stats as any;
    const v = (n && (n[a] ?? n[b])) ?? 0;
    return typeof v === 'number' ? v : (typeof v === 'string' ? (parseInt(v, 10) || 0) : 0);
  };
  const statCards = [
    {
      label: '文档总数',
      value: pick('documents_count', 'documents'),
      sub: '已摄入知识来源',
      icon: FileText,
      gradient: 'from-cyan-400 via-primary-500 to-primary-700',
      bg: 'bg-primary-50',
      iconColor: 'text-primary-600',
    },
    {
      label: '长期记忆',
      value: pick('memories_count', 'memories'),
      sub: '结构化知识条目',
      icon: Brain,
      gradient: 'from-amber-400 via-accent-500 to-accent-700',
      bg: 'bg-accent-50',
      iconColor: 'text-accent-600',
    },
    {
      label: '对话会话',
      value: pick('conversations_count', 'conversations'),
      sub: '历史问答记录',
      icon: MessageCircle,
      gradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: '向量分块',
      value: pick('chunks_count', 'chunks'),
      sub: '可检索知识单元',
      icon: DatabaseZap,
      gradient: 'from-violet-400 via-violet-500 to-violet-700',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
  ];

  const quickActions = [
    {
      title: '上传文档',
      desc: 'PDF / Word / 文本等',
      emoji: '📤',
      icon: UploadCloud,
      onClick: () => nav('/documents'),
      variant: 'primary',
    },
    {
      title: '开始对话',
      desc: '向你的知识库提问',
      emoji: '💭',
      icon: MessageSquarePlus,
      onClick: () => nav('/chat'),
      variant: 'accent',
    },
    {
      title: '系统体检',
      desc: '检查数据库与服务状态',
      emoji: '🩺',
      icon: Activity,
      onClick: () => nav('/maintenance'),
      variant: 'ghost',
    },
    {
      title: '导出数据',
      desc: '备份你的个人知识',
      emoji: '💾',
      icon: FileOutput,
      onClick: () => nav('/privacy'),
      variant: 'ghost',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden card p-6 lg:p-8 bg-gradient-to-br from-primary-50 via-white to-accent-50 border-primary-100">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary-200/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-gradient-to-br from-accent-200/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 badge bg-white text-primary-700 border border-primary-200 shadow-sm mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              欢迎回到你的数字知识伙伴
            </div>
            <h1 className="font-serif text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
              你的知识，<span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">随时可及</span>
            </h1>
            <p className="mt-3 text-slate-600 text-sm lg:text-base leading-relaxed">
              上传文档、记录记忆、提问对话——Self Knowledge Agent 帮你把零散信息沉淀为可检索、可思考的个人知识库。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => nav('/documents')} className="btn-primary !px-5 !py-2.5">
              <FolderPlus className="w-4.5 h-4.5" /> 开始搭建知识库 <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => nav('/chat')} className="btn-accent !px-5 !py-2.5">
              <MessageSquarePlus className="w-4.5 h-4.5" /> 立刻提问
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              style={{ animationDelay: `${i * 60}ms` }}
              className="relative card p-5 group hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 animate-slide-up"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">{c.label}</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 font-serif tabular-nums">
                    {loading ? (
                      <span className="inline-block w-16 h-8 bg-slate-100 rounded animate-pulse-soft" />
                    ) : (
                      c.value
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{c.sub}</div>
                </div>
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center ${c.iconColor}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${c.gradient} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚡</span>
            <h2 className="font-serif text-lg font-bold text-slate-800">快捷操作</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              const cls =
                a.variant === 'primary'
                  ? 'from-primary-500 to-primary-700 text-white shadow-card hover:shadow-card-hover'
                  : a.variant === 'accent'
                  ? 'from-accent-500 to-accent-700 text-white shadow-card hover:shadow-card-hover'
                  : 'from-white to-slate-50 text-slate-700 border border-slate-200 hover:border-primary-200';
              return (
                <button
                  key={a.title}
                  onClick={a.onClick}
                  className={`group relative text-left p-4 rounded-xl2 bg-gradient-to-br ${cls} transition-all duration-200 hover:-translate-y-0.5`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-lg">{a.emoji}</span>
                  </div>
                  <div className="mt-3">
                    <div className="font-semibold text-sm">{a.title}</div>
                    <div className={`text-[11px] mt-0.5 ${a.variant === 'ghost' ? 'text-slate-500' : 'opacity-80'}`}>{a.desc}</div>
                  </div>
                  <ArrowRight className="absolute right-3 bottom-3 w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">💡</span>
            <h2 className="font-serif text-lg font-bold text-slate-800">使用提示</h2>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            {[
              '上传 PDF、Word、Markdown、TXT 文件或网页 URL 构建知识库',
              '记录长期记忆（偏好、重要事实），对话时会被自动引用',
              '提问后查看「引用来源」可追溯答案的原文依据',
              '定期执行健康检查 + 备份，确保知识库数据安全',
              '需要清空或迁移时，使用隐私页导出/擦除功能',
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-3 group">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center text-xs font-bold text-primary-700 group-hover:scale-110 transition">
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
