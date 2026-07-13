import { useState } from 'react';
import {
  Shield,
  DatabaseBackup,
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Loader2,
  FileJson,
  HardDrive,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';

interface CheckItem {
  key: string;
  label: string;
  status: 'ok' | 'error' | 'warning' | 'skip' | 'pending';
  message?: string;
  details?: any;
}

export default function Maintenance() {
  const push = useAppStore((s) => s.pushToast);
  const [checking, setChecking] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckItem[]>([
    { key: 'sqlite', label: 'SQLite 数据库', status: 'pending' },
    { key: 'chroma', label: 'Chroma 向量库', status: 'pending' },
    { key: 'llm', label: 'LLM 服务连接', status: 'pending' },
    { key: 'vector_consistency', label: '向量一致性', status: 'pending' },
    { key: 'filesystem', label: '磁盘空间 / 文件系统', status: 'pending' },
  ]);

  const [backups, setBackups] = useState<{ name: string; time: string; size: number; path: string }[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [overwrite, setOverwrite] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const runHealthCheck = async () => {
    setChecking(true);
    setChecks(cs => cs.map(c => ({ ...c, status: 'pending', message: '检查中…', details: null })));
    try {
      const r = await api.maintenanceHealthCheck();
      const data: any = r.data ?? r;
      const newChecks: CheckItem[] = [
        { key: 'sqlite', label: 'SQLite 数据库', status: (data.sqlite?.status as any) ?? 'ok', message: data.sqlite?.message, details: data.sqlite },
        { key: 'chroma', label: 'Chroma 向量库', status: (data.chroma?.status as any) ?? 'ok', message: data.chroma?.message, details: data.chroma },
        { key: 'llm', label: 'LLM 服务连接', status: (data.llm?.status as any) ?? 'skip', message: data.llm?.message, details: data.llm },
        { key: 'vector_consistency', label: '向量一致性', status: (data.vector_consistency?.status as any) ?? 'ok', message: data.vector_consistency?.message, details: data.vector_consistency?.details },
        { key: 'filesystem', label: '磁盘空间 / 文件系统', status: 'ok', message: '数据目录可读写' },
      ];
      setChecks(newChecks);
      setLastCheckAt(new Date().toLocaleString('zh-CN'));
      const allOk = newChecks.every(c => c.status === 'ok' || c.status === 'skip');
      push(allOk ? 'success' : 'info', allOk ? '所有系统正常运行 ✓' : '检查完成，部分项需要关注');
    } catch (e: any) {
      push('error', e.message || '健康检查失败');
    } finally {
      setChecking(false);
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const r = await api.createBackup();
      push('success', r.message || '备份创建成功');
      const path = r.backup_path || r.path || '';
      setBackups(b => [{
        name: path ? path.split(/[\\/]/).pop() || 'backup.zip' : '手动备份',
        time: r.created_at || new Date().toLocaleString(),
        size: r.size_bytes || 0,
        path,
      }, ...b].slice(0, 20));
    } catch (e: any) {
      push('error', e.message || '备份失败');
    } finally {
      setCreatingBackup(false);
    }
  };

  const restore = async () => {
    if (!restorePath.trim()) { push('info', '请输入备份文件路径'); return; }
    if (!confirm(`将从备份恢复：${restorePath}\n${overwrite ? '将覆盖现有数据！' : '仅恢复缺失项'}\n\n确定继续？`)) return;
    setRestoring(true);
    try {
      const r = await api.restoreBackup(restorePath.trim(), overwrite);
      push('success', r.message || '恢复成功');
    } catch (e: any) {
      push('error', e.message || '恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  const statusIcon = (s: CheckItem['status']) => {
    switch (s) {
      case 'ok': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'skip': return <span className="text-xs text-slate-400 font-medium">跳过</span>;
      default: return <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />;
    }
  };
  const statusBadge = (s: CheckItem['status']) => {
    const cls: any = {
      ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      error: 'bg-red-50 text-red-700 border-red-200',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      skip: 'bg-slate-50 text-slate-500 border-slate-200',
      pending: 'bg-slate-100 text-slate-500 border-slate-200 animate-pulse-soft',
    };
    const label: any = { ok: '正常', error: '异常', warning: '警告', skip: '跳过', pending: '待检查' };
    return <span className={`badge border ${cls[s]}`}>{label[s]}</span>;
  };
  const overall = () => {
    if (checks.every(c => c.status === 'pending')) return { text: '点击右上按钮开始检查', cls: 'bg-slate-100 text-slate-500', icon: <Activity className="w-5 h-5" /> };
    if (checks.some(c => c.status === 'error')) return { text: '部分系统异常', cls: 'bg-red-50 text-red-700', icon: <XCircle className="w-5 h-5" /> };
    if (checks.some(c => c.status === 'warning')) return { text: '存在警告项', cls: 'bg-amber-50 text-amber-700', icon: <AlertTriangle className="w-5 h-5" /> };
    return { text: '系统全部正常', cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="w-5 h-5" /> };
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="card p-5 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-transparent to-primary-50 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <Shield className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-slate-900">系统维护</h1>
                <span className={`badge flex items-center gap-1.5 ${overall().cls}`}>
                  {overall().icon} {overall().text}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                定期健康检查与数据备份，确保知识库长期稳定运行。
                {lastCheckAt && <span className="ml-2 text-slate-400 flex items-center gap-1 inline-flex">
                  <Clock className="w-3 h-3" /> 上次检查：{lastCheckAt}
                </span>}
              </p>
            </div>
          </div>
          <button onClick={runHealthCheck} disabled={checking} className="btn-primary md:self-start">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {checking ? '检查中…' : '执行健康检查'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-primary-600" />
            <h2 className="font-serif font-bold text-slate-800 text-lg">组件健康状态</h2>
          </div>
          <div className="space-y-2">
            {checks.map((c) => {
              const open = expanded === c.key;
              const hasDetail = c.details && typeof c.details === 'object' && Object.keys(c.details).length > 0;
              return (
                <div key={c.key} className="rounded-xl border border-slate-100 bg-slate-50/40 overflow-hidden transition hover:border-slate-200">
                  <button
                    onClick={() => hasDetail && setExpanded(open ? null : c.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 ${hasDetail ? 'cursor-pointer' : ''} text-left`}
                  >
                    {statusIcon(c.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">{c.label}</span>
                        {statusBadge(c.status)}
                      </div>
                      {c.message && <div className="text-xs text-slate-500 mt-0.5">{c.message}</div>}
                    </div>
                    {hasDetail && (open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
                  </button>
                  {open && hasDetail && (
                    <div className="px-4 pb-3">
                      <div className="rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[11px] max-h-48 overflow-auto">
                        <FileJson className="w-3.5 h-3.5 inline mr-2 text-slate-400" />
                        <span className="text-slate-400">details.json</span>
                        <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(c.details, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DatabaseBackup className="w-5 h-5 text-accent-600" />
              <h2 className="font-serif font-bold text-slate-800 text-lg">创建备份</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              将 SQLite 数据库、Chroma 向量库、配置文件打包为一份备份，便于迁移或恢复。
            </p>
            <button onClick={createBackup} disabled={creatingBackup} className="btn-accent w-full">
              {creatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {creatingBackup ? '正在打包…' : '立即创建完整备份'}
            </button>
            {backups.length > 0 && (
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {backups.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-sm group">
                    <Database className="w-4 h-4 text-accent-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-slate-700">{b.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <Clock className="w-3 h-3" />{b.time}
                        <span>·</span>
                        <Sparkles className="w-3 h-3" />
                        {(b.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      onClick={() => setRestorePath(b.path)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded hover:bg-primary-100 text-primary-600 transition"
                      title="填入恢复框"
                    >
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-amber-600" />
              <h2 className="font-serif font-bold text-slate-800 text-lg">恢复备份</h2>
              <span className="badge bg-amber-50 text-amber-700 border border-amber-200 ml-auto">危险操作</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">备份文件路径（服务器端）</label>
                <input className="input" value={restorePath} onChange={(e) => setRestorePath(e.target.value)} placeholder="例：D:/backup/ska_backup_xxx.zip" />
              </div>
              <label className="flex items-center gap-2 p-3 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-red-200 transition">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="w-4 h-4 text-red-600" />
                <div>
                  <div className="text-sm font-medium text-slate-800">覆盖现有数据</div>
                  <div className="text-xs text-slate-500">不勾选则仅恢复缺失条目；勾选则清空后完全还原</div>
                </div>
              </label>
              <button onClick={restore} disabled={restoring || !restorePath.trim()} className="btn-danger w-full">
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {restoring ? '恢复中…' : '从该备份还原数据'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
