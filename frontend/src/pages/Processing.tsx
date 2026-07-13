import { useState } from 'react';
import {
  Cpu,
  RefreshCcw,
  RefreshCw,
  FileSearch,
  DatabaseZap,
  CheckCircle2,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Zap,
  FolderSync,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { DocumentOut } from '@/types';

export default function Processing() {
  const push = useAppStore((s) => s.pushToast);
  const [docId, setDocId] = useState('');
  const [docKeyword, setDocKeyword] = useState('');
  const [docCandidates, setDocCandidates] = useState<DocumentOut[]>([]);
  const [searching, setSearching] = useState(false);
  const [singleLoading, setSingleLoading] = useState(false);
  const [incremental, setIncremental] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [logs, setLogs] = useState<{ time: string; type: 'info' | 'success' | 'warn'; text: string }[]>([
    { time: new Date().toLocaleTimeString(), type: 'info', text: '准备就绪，可以执行索引任务。' },
  ]);
  const log = (type: 'info' | 'success' | 'warn', text: string) =>
    setLogs(l => [...l, { time: new Date().toLocaleTimeString(), type, text }].slice(-100));

  const searchDocs = async () => {
    if (!docKeyword.trim()) return;
    setSearching(true);
    try {
      const r = await api.listDocuments({ keyword: docKeyword.trim(), page: 1, page_size: 8 });
      const list: DocumentOut[] = r.items ?? r.data ?? [];
      setDocCandidates(Array.isArray(list) ? list : []);
    } catch (e: any) { push('error', e.message || '搜索失败'); }
    finally { setSearching(false); }
  };

  const reindexSingle = async () => {
    const id = docId.trim();
    if (!id) { push('info', '请先选择一个文档'); return; }
    setSingleLoading(true);
    log('info', `开始重新索引文档 ${id}`);
    try {
      const r = await api.reindexDocument(id);
      log('success', r.message || '任务提交成功，后台正在处理');
      push('success', '已提交重新索引');
    } catch (e: any) {
      log('warn', e.message || '任务失败');
      push('error', e.message || '提交失败');
    } finally { setSingleLoading(false); }
  };

  const reindexAll = async () => {
    if (!confirm(`即将执行全量${incremental ? '增量' : '完整'}重索引，是否继续？\n完整重索引将清除并重建所有向量，可能耗时较长。`)) return;
    setAllLoading(true);
    log('info', `开始执行全量${incremental ? '增量' : '完整'}重索引…`);
    try {
      const r = await api.reindexAll(incremental);
      log('success', `执行完毕。${r.message || ''}`);
      push('success', '全量重索引已完成');
    } catch (e: any) {
      log('warn', e.message || '执行失败');
      push('error', e.message || '执行失败');
    } finally { setAllLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 animate-fade-in">
      <div className="lg:col-span-3 space-y-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚙️</span>
            <h2 className="font-serif text-lg font-bold text-slate-800">知识处理中心</h2>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            文档向量化与索引管理。如发现问答引用旧内容、或文档处理失败，可在此处重新执行分块、嵌入与入库流程。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-primary-200 flex items-center justify-center text-primary-600">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">单文档重索引</h3>
                  <div className="text-xs text-slate-500">仅处理指定文档</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">搜索文档</label>
                  <div className="flex gap-2">
                    <input
                      value={docKeyword} onChange={(e) => setDocKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchDocs()}
                      className="input" placeholder="输入标题关键词…"
                    />
                    <button onClick={searchDocs} disabled={searching || !docKeyword.trim()} className="btn-ghost !px-3">
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    </button>
                  </div>
                  {docCandidates.length > 0 && (
                    <div className="mt-2 rounded-xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {docCandidates.map(d => (
                        <button
                          key={d.id} onClick={() => { setDocId(d.id); setDocCandidates([]); setDocKeyword(d.title); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition ${docId === d.id ? 'bg-primary-50' : ''}`}
                        >
                          <div className="font-medium text-slate-700 truncate">{d.title}</div>
                          <div className="text-[11px] text-slate-400">{d.file_type?.toUpperCase()} · {d.tags?.slice(0, 3).join(', ') || '无标签'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">文档 ID</label>
                  <input
                    value={docId} onChange={(e) => setDocId(e.target.value)}
                    className="input" placeholder="选择上方结果或手动粘贴 ID"
                  />
                </div>
                <button onClick={reindexSingle} disabled={singleLoading || !docId.trim()} className="btn-primary w-full">
                  {singleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                  重新索引该文档
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-50/60 to-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-accent-200 flex items-center justify-center text-accent-600">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">全量重索引</h3>
                  <div className="text-xs text-slate-500">批量处理所有文档</div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-accent-200 transition">
                  <input
                    type="radio" checked={incremental} onChange={() => setIncremental(true)}
                    className="w-4 h-4 text-accent-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800">增量模式（推荐）</div>
                    <div className="text-xs text-slate-500">跳过已索引、仅处理 pending/error 状态</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-red-200 transition">
                  <input
                    type="radio" checked={!incremental} onChange={() => setIncremental(false)}
                    className="w-4 h-4 text-red-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800 flex items-center gap-1">
                      完整重建
                      <span className="badge bg-red-50 text-red-600 text-[10px]">谨慎</span>
                    </div>
                    <div className="text-xs text-slate-500">清除所有向量后重新嵌入，耗时较长</div>
                  </div>
                </label>
                <button onClick={reindexAll} disabled={allLoading} className="btn-accent w-full">
                  {allLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {allLoading ? '处理中…' : '执行全量重索引'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="card p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-primary-600" />
            <h3 className="font-serif font-bold text-slate-800">处理流程说明</h3>
          </div>
          <ol className="space-y-3">
            {[
              ['分块', '按 512 字符大小将文档切分为重叠片段', 'text'],
              ['清洗', '去除乱码、冗余空白、无效字符', 'clean'],
              ['嵌入', '使用 BGE-small-zh 生成向量表征', 'vector'],
              ['入库', '写入 Chroma 向量库 + SQLite 元数据', 'save'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-bold shadow-md">
                    {i + 1}
                  </div>
                  {i < 3 && <ChevronRight className="absolute left-1/2 -translate-x-1/2 top-full text-primary-200 w-4 h-4 mt-0.5 rotate-90" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="text-sm font-semibold text-slate-800">{title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DatabaseZap className="w-5 h-5 text-accent-600" />
              <h3 className="font-serif font-bold text-slate-800">执行日志</h3>
            </div>
            <button onClick={() => setLogs([])} className="text-xs text-slate-400 hover:text-slate-600">清空</button>
          </div>
          <div className="rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] h-64 overflow-y-auto space-y-1">
            {logs.map((l, i) => (
              <div key={i} className={`flex gap-2 ${
                l.type === 'success' ? 'text-emerald-300' : l.type === 'warn' ? 'text-amber-300' : 'text-slate-300'
              }`}>
                <span className="text-slate-500 flex-shrink-0">[{l.time}]</span>
                <span className="flex-shrink-0">
                  {l.type === 'success' ? <CheckCircle2 className="w-3 h-3 mt-0.5" /> : l.type === 'warn' ? <AlertTriangle className="w-3 h-3 mt-0.5" /> : '›'}
                </span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
