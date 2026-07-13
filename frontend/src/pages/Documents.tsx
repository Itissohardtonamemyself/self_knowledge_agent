import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Globe,
  Search,
  LayoutGrid,
  List,
  Filter,
  Trash2,
  RefreshCw,
  Edit,
  FileText,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { DocumentOut } from '@/types';

type Tab = 'upload' | 'url';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  processing: 'bg-accent-100 text-accent-700',
  indexed: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '等待',
  processing: '处理中',
  indexed: '已索引',
  error: '失败',
};

const FILE_ICON: Record<string, string> = {
  pdf: '📕',
  docx: '📘', doc: '📘',
  md: '📓',
  txt: '📄',
  html: '🌐', htm: '🌐', url: '🌐',
};
function fileIcon(ft: string) {
  return FILE_ICON[ft] || (ft === 'url' ? '🌐' : '📄');
}
function formatSize(bytes?: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function Documents() {
  const push = useAppStore((s) => s.pushToast);
  const documents = useAppStore((s) => s.documents);
  const total = useAppStore((s) => s.documentTotal);
  const loading = useAppStore((s) => s.documentsLoading);
  const setDocs = useAppStore((s) => s.setDocuments);
  const setLoading = useAppStore((s) => s.setDocumentsLoading);
  const upsert = useAppStore((s) => s.upsertDocument);
  const remove = useAppStore((s) => s.removeDocument);

  const [tab, setTab] = useState<Tab>('upload');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [keyword, setKeyword] = useState('');
  const [fileType, setFileType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [exts, setExts] = useState<string[]>([]);

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState('');
  const [uploading, setUploading] = useState(false);

  // URL form
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlTags, setUrlTags] = useState<string[]>([]);
  const [urlTagInput, setUrlTagInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Edit
  const [editing, setEditing] = useState<DocumentOut | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setExts(await api.getSupportedExtensions()); } catch {}
    })();
  }, []);

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line
  }, [keyword, fileType, status, page]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const r = await api.listDocuments({
        keyword, file_type: fileType || undefined, status: status || undefined, page, page_size: pageSize,
      });
      setDocs(r.items ?? r.data ?? [], r.total ?? 0);
    } catch (e: any) {
      push('error', e.message || '加载文档失败');
    } finally {
      setLoading(false);
    }
  };

  const startUpload = () => fileRef.current?.click();

  const submitUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await api.uploadDocument(file, uploadTags);
      upsert({
        id: r.id, title: file.name, file_type: (file.name.split('.').pop() || '').toLowerCase(),
        source: 'upload', status: r.status as any, tags: uploadTags,
        file_size: file.size, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      push('success', `上传成功：${file.name}`);
      setFile(null);
      setUploadTags([]);
      loadDocs();
    } catch (e: any) {
      push('error', e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const submitUrl = async () => {
    if (!url.trim()) return;
    setImporting(true);
    try {
      const r = await api.importUrl({ url: url.trim(), title: urlTitle.trim() || undefined, tags: urlTags });
      push('success', 'URL 导入已开始处理');
      setUrl(''); setUrlTitle(''); setUrlTags([]);
      loadDocs();
    } catch (e: any) {
      push('error', e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (d: DocumentOut) => {
    if (!confirm(`删除文档「${d.title}」？\n关联向量索引也将被清理。`)) return;
    try {
      await api.deleteDocument(d.id);
      remove(d.id);
      push('success', '已删除');
    } catch (e: any) { push('error', e.message || '删除失败'); }
  };

  const onReindex = async (id: string) => {
    setReindexing(id);
    try {
      await api.reindexDocument(id);
      push('success', '重新索引任务已提交');
      setTimeout(loadDocs, 800);
    } catch (e: any) {
      push('error', e.message || '操作失败');
    } finally {
      setReindexing(null);
    }
  };

  const openEdit = (d: DocumentOut) => {
    setEditing(d);
    setEditTitle(d.title);
    setEditDesc(d.description || '');
    setEditTags(d.tags || []);
    setEditTagInput('');
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const r = await api.updateDocument(editing.id, {
        title: editTitle.trim() || undefined,
        description: editDesc || undefined,
        tags: editTags,
      });
      upsert(r);
      push('success', '保存成功');
      setEditing(null);
    } catch (e: any) {
      push('error', e.message || '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⬆️</span>
              <h2 className="font-serif text-lg font-bold text-slate-800">新增文档</h2>
            </div>
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
              <button
                onClick={() => setTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${
                  tab === 'upload' ? 'bg-white text-primary-700 shadow' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload className="w-4 h-4" /> 上传文件
              </button>
              <button
                onClick={() => setTab('url')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition ${
                  tab === 'url' ? 'bg-white text-primary-700 shadow' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Globe className="w-4 h-4" /> 导入 URL
              </button>
            </div>

            {tab === 'upload' ? (
              <div className="space-y-4">
                <div
                  onClick={startUpload}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                  className={`border-2 border-dashed rounded-xl2 p-6 text-center cursor-pointer transition ${
                    dragOver ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                  }`}
                >
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div className="flex items-center gap-3 justify-center">
                      <span className="text-3xl">{fileIcon((file.name.split('.').pop() || '').toLowerCase())}</span>
                      <div className="text-left">
                        <div className="font-medium text-sm text-slate-800">{file.name}</div>
                        <div className="text-xs text-slate-400">{formatSize(file.size)}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <File className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <div className="text-sm font-medium text-slate-700">点击或拖拽文件到此处</div>
                      <div className="text-xs text-slate-400 mt-1">
                        支持 {exts.length ? exts.map(e => e.toUpperCase()).join(', ') : 'PDF, DOCX, MD, TXT'} 等
                      </div>
                    </>
                  )}
                </div>
                <TagEditor label="标签" tags={uploadTags} tagInput={uploadTagInput} setTags={setUploadTags} setTagInput={setUploadTagInput} />
                <button
                  disabled={!file || uploading}
                  onClick={submitUpload}
                  className="btn-primary w-full"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? '处理中…' : '上传并处理'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">网页 URL</label>
                  <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">自定义标题（可选）</label>
                  <input className="input" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="留空则使用网页标题" />
                </div>
                <TagEditor label="标签" tags={urlTags} tagInput={urlTagInput} setTags={setUrlTags} setTagInput={setUrlTagInput} />
                <button disabled={!url.trim() || importing} onClick={submitUrl} className="btn-primary w-full">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  {importing ? '导入中…' : '抓取并导入'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 card p-5 flex flex-col min-h-[600px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <h2 className="font-serif text-lg font-bold text-slate-800">
                文档列表
                <span className="ml-2 text-sm font-sans text-slate-400">共 {total} 篇</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  className="input !pl-9 sm:w-56" placeholder="搜索标题/描述/标签…"
                />
              </div>
              <select
                value={fileType} onChange={(e) => { setFileType(e.target.value); setPage(1); }}
                className="input !py-2 sm:w-28"
              >
                <option value="">全部类型</option>
                {exts.map(e => <option key={e} value={e}>{e.toUpperCase()}</option>)}
              </select>
              <select
                value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="input !py-2 sm:w-28"
              >
                <option value="">全部状态</option>
                <option value="pending">等待</option>
                <option value="processing">处理中</option>
                <option value="indexed">已索引</option>
                <option value="error">失败</option>
              </select>
              <div className="hidden sm:flex p-1 rounded-lg bg-slate-100">
                <button onClick={() => setView('list')} className={`p-1.5 rounded-md ${view === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-4 h-4" /></button>
                <button onClick={() => setView('grid')} className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-4 h-4" /></button>
              </div>
              <button onClick={loadDocs} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="刷新"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400">
                <FileText className="w-12 h-12 mb-2 text-slate-200" />
                <div className="text-sm">暂无文档，试试上传第一个文件吧</div>
              </div>
            ) : view === 'list' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-2 font-medium">文档</th>
                    <th className="py-2.5 px-2 font-medium">类型</th>
                    <th className="py-2.5 px-2 font-medium">标签</th>
                    <th className="py-2.5 px-2 font-medium">状态</th>
                    <th className="py-2.5 px-2 font-medium">分块</th>
                    <th className="py-2.5 px-2 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg flex-shrink-0">{fileIcon(d.file_type || d.source)}</span>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate max-w-[240px]">{d.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">
                              {d.source === 'url' && d.source_url ? d.source_url : formatSize(d.file_size)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 uppercase text-xs text-slate-500">{d.file_type || d.source}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {(d.tags || []).slice(0, 3).map(t => (
                            <span key={t} className="badge bg-primary-50 text-primary-700">#{t}</span>
                          ))}
                          {(d.tags || []).length > 3 && <span className="text-[10px] text-slate-400">+{(d.tags || []).length - 3}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`badge ${STATUS_STYLE[d.status] || ''}`}>
                          {d.status === 'indexed' ? <CheckCircle2 className="w-3 h-3" /> : d.status === 'error' ? <AlertCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                          {STATUS_LABEL[d.status] || d.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-600 tabular-nums">{d.chunk_count ?? '-'}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => onReindex(d.id)} disabled={reindexing === d.id} className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-500 hover:text-primary-600" title="重新索引">
                            {reindexing === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-accent-50 text-slate-500 hover:text-accent-600" title="编辑">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDelete(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600" title="删除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {documents.map((d) => (
                  <div key={d.id} className="card p-4 hover:shadow-card-hover transition group">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">{fileIcon(d.file_type || d.source)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{d.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{(d.tags || []).length} 个标签 · {d.chunk_count ?? 0} 块</div>
                      </div>
                      <span className={`badge ${STATUS_STYLE[d.status] || ''}`}>{STATUS_LABEL[d.status] || d.status}</span>
                    </div>
                    {(d.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(d.tags || []).slice(0, 4).map(t => <span key={t} className="badge bg-slate-100 text-slate-600">#{t}</span>)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => onReindex(d.id)} className="btn-ghost !py-1 !px-2 text-xs flex-1"><RefreshCw className="w-3 h-3" /> 重索引</button>
                      <button onClick={() => openEdit(d)} className="btn-ghost !py-1 !px-2 text-xs flex-1"><Edit className="w-3 h-3" /> 编辑</button>
                      <button onClick={() => onDelete(d)} className="btn-ghost !py-1 !px-2 text-xs text-red-600 hover:bg-red-50 flex-1"><Trash2 className="w-3 h-3" /> 删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              第 {page} / {totalPages} 页 · 共 {total} 条
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost !py-1.5 !px-2 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-sm text-slate-600 tabular-nums">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost !py-1.5 !px-2 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg animate-slide-up p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-slate-800">编辑文档</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">标题</label>
                <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">描述</label>
                <textarea rows={3} className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="可选，为该文档写一段简要描述" />
              </div>
              <TagEditor label="标签" tags={editTags} tagInput={editTagInput} setTags={setEditTags} setTagInput={setEditTagInput} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="btn-ghost">取消</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary">
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagEditor({ label, tags, tagInput, setTags, setTagInput }: {
  label: string; tags: string[]; tagInput: string; setTags: (t: string[]) => void; setTagInput: (v: string) => void;
}) {
  const add = () => {
    const v = tagInput.trim().replace(/^#/, '');
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
        <Tag className="w-3.5 h-3.5" /> {label}
      </label>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl2 border border-slate-200 bg-white min-h-[42px]">
        {tags.map((t) => (
          <span key={t} className="badge bg-primary-50 text-primary-700 gap-1">
            #{t}
            <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-primary-900 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex-1 flex items-center gap-1 min-w-[120px]">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
              if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
            }}
            placeholder={tags.length ? '' : '输入后回车添加标签…'}
            className="flex-1 bg-transparent outline-none text-sm min-w-0"
          />
          {tagInput && (
            <button onClick={add} className="p-1 rounded hover:bg-primary-100 text-primary-600">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
