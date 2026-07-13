import { useEffect, useState } from 'react';
import {
  User,
  Briefcase,
  Heart,
  GraduationCap,
  FileText,
  Save,
  Plus,
  Trash2,
  Loader2,
  Star,
  Archive,
  Search,
  X,
  Lightbulb,
  Brain,
  Tag,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { LongTermMemoryOut, UserProfileOut } from '@/types';

const LEARNING_STYLES = ['视觉型', '听觉型', '阅读型', '动手型', '逻辑型', '综合型'];
const INTEREST_SUGGESTIONS = ['技术', '历史', '哲学', '经济学', '心理学', '艺术', '编程', '设计', '写作', '数学', '物理', '生物'];

export default function Memory() {
  const push = useAppStore((s) => s.pushToast);
  const profile = useAppStore((s) => s.profile);
  const memories = useAppStore((s) => s.memories);
  const memTotal = useAppStore((s) => s.memoryTotal);
  const setProfile = useAppStore((s) => s.setProfile);
  const setMems = useAppStore((s) => s.setMemories);
  const upsertMem = useAppStore((s) => s.upsertMemory);
  const removeMem = useAppStore((s) => s.removeMemory);

  const [pName, setPName] = useState('');
  const [pOcc, setPOcc] = useState('');
  const [pStyle, setPStyle] = useState('');
  const [pBg, setPBg] = useState('');
  const [pInterests, setPInterests] = useState<string[]>([]);
  const [pInterestInput, setPInterestInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [mPage, setMPage] = useState(1);
  const mPageSize = 12;

  // new memory form
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newImp, setNewImp] = useState(3);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, m] = await Promise.all([
          api.getProfile(),
          api.listLongTermMemories({ keyword: q, status, page: mPage, page_size: mPageSize }),
        ]);
        const prof: UserProfileOut = p;
        setProfile(prof);
        setPName(prof.name || '');
        setPOcc(prof.occupation || '');
        setPStyle(prof.learning_style || '');
        setPBg(prof.background || '');
        setPInterests(prof.interests || []);
        const items: LongTermMemoryOut[] = m.items ?? m.data ?? [];
        setMems(Array.isArray(items) ? items : [], m.total ?? 0);
      } catch (e: any) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [q, status, mPage]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await api.updateProfile({
        name: pName.trim() || undefined,
        occupation: pOcc.trim() || undefined,
        learning_style: pStyle || undefined,
        background: pBg || undefined,
        interests: pInterests,
      });
      setProfile(r);
      push('success', '用户画像已保存');
    } catch (e: any) {
      push('error', e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const createMem = async () => {
    if (!newContent.trim()) return;
    setCreating(true);
    try {
      const r = await api.createLongTermMemory({
        content: newContent.trim(),
        tags: newTags,
        importance: newImp,
      });
      upsertMem(r);
      push('success', '记忆已创建');
      setNewContent('');
      setNewTags([]);
      setNewImp(3);
    } catch (e: any) {
      push('error', e.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteMem = async (id: number) => {
    if (!confirm('删除这条记忆？')) return;
    try {
      await api.deleteLongTermMemory(id);
      removeMem(id);
      push('success', '已删除');
    } catch (e: any) {
      push('error', e.message || '删除失败');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 animate-fade-in">
      <section className="lg:col-span-2 card p-5 space-y-5 h-fit">
        <div className="flex items-center gap-2">
          <span className="text-lg">👤</span>
          <h2 className="font-serif text-lg font-bold text-slate-800">用户画像</h2>
          <span className="badge bg-primary-50 text-primary-700 ml-auto">
            {profile ? '已配置' : '首次配置'}
          </span>
        </div>
        {loading && !profile ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <Field icon={<User className="w-4 h-4" />} label="昵称 / 姓名">
              <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="你希望我怎么称呼你？" />
            </Field>
            <Field icon={<Briefcase className="w-4 h-4" />} label="职业 / 身份">
              <input className="input" value={pOcc} onChange={(e) => setPOcc(e.target.value)} placeholder="例如：软件工程师、学生、研究员" />
            </Field>
            <Field icon={<GraduationCap className="w-4 h-4" />} label="偏好的学习风格">
              <select className="input" value={pStyle} onChange={(e) => setPStyle(e.target.value)}>
                <option value="">— 未指定 —</option>
                {LEARNING_STYLES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field icon={<Heart className="w-4 h-4" />} label="兴趣领域">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl2 border border-slate-200 bg-white min-h-[42px]">
                  {pInterests.map(t => (
                    <span key={t} className="badge bg-accent-50 text-accent-700">
                      #{t}
                      <button onClick={() => setPInterests(pInterests.filter(x => x !== t))} className="hover:text-accent-900 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={pInterestInput}
                    onChange={(e) => setPInterestInput(e.target.value)}
                    onKeyDown={(e) => {
                      const v = pInterestInput.trim();
                      if ((e.key === 'Enter' || e.key === ',') && v) {
                        e.preventDefault();
                        if (!pInterests.includes(v)) setPInterests([...pInterests, v]);
                        setPInterestInput('');
                      }
                    }}
                    className="flex-1 bg-transparent outline-none text-sm min-w-[100px]"
                    placeholder="输入后回车添加…"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[11px] text-slate-400 mr-1">推荐：</span>
                  {INTEREST_SUGGESTIONS.filter(s => !pInterests.includes(s)).slice(0, 8).map(s => (
                    <button
                      key={s}
                      onClick={() => setPInterests([...pInterests, s])}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-accent-100 text-slate-500 hover:text-accent-700 transition"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
            <Field icon={<FileText className="w-4 h-4" />} label="个人背景 / 简述">
              <textarea
                rows={4} className="input resize-none" value={pBg}
                onChange={(e) => setPBg(e.target.value)}
                placeholder="简要介绍一下你的背景、擅长领域、关注方向… 这些信息将帮助我更好地回答你的问题。"
              />
            </Field>
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存用户画像
            </button>
          </div>
        )}
      </section>

      <section className="lg:col-span-3 space-y-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✨</span>
            <h2 className="font-serif text-lg font-bold text-slate-800">记录新的长期记忆</h2>
          </div>
          <div className="space-y-3">
            <textarea
              rows={3}
              className="input"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="记录一条值得长期保留的信息：重要事实、决策、偏好、个人原则、灵感、笔记…"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TagEditorSmall
                tags={newTags} tagInput={newTagInput}
                setTags={setNewTags} setTagInput={setNewTagInput}
              />
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-accent-500" /> 重要性（{newImp}/5）
                </label>
                <div className="flex items-center gap-1 px-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setNewImp(n)} className="p-1 rounded hover:scale-110 transition">
                      <Star className={`w-5 h-5 ${n <= newImp ? 'fill-accent-500 text-accent-500' : 'text-slate-200'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-slate-500">
                    {['偶尔参考', '一般', '较重要', '重要', '核心原则'][newImp - 1]}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={createMem} disabled={!newContent.trim() || creating} className="btn-accent w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              存入长期记忆
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <h2 className="font-serif text-lg font-bold text-slate-800">
                长期记忆库
                <span className="ml-2 text-sm font-sans text-slate-400">共 {memTotal} 条</span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={q} onChange={(e) => { setQ(e.target.value); setMPage(1); }} className="input !pl-9 !py-2 sm:w-56" placeholder="搜索记忆内容…" />
              </div>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setMPage(1); }} className="input !py-2 w-28">
                <option value="active">启用中</option>
                <option value="archived">已归档</option>
                <option value="">全部</option>
              </select>
            </div>
          </div>

          {loading && memories.length === 0 ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div>
          ) : memories.length === 0 ? (
            <div className="text-center py-10">
              <Brain className="w-12 h-12 mx-auto mb-2 text-slate-200" />
              <div className="text-sm text-slate-500">还没有长期记忆</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                <Lightbulb className="w-3 h-3" />
                建议记录：重要日期、偏好设定、核心价值观、关键决策与理由…
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {memories.map((m) => (
                <div key={m.id} className="card p-4 hover:shadow-card-hover transition group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < m.importance ? 'fill-accent-500 text-accent-500' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <span className={`badge ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {m.status === 'active' ? <>启用</> : <><Archive className="w-3 h-3" /> 归档</>}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {m.content}
                  </p>
                  {(m.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(m.tags || []).map(t => <span key={t} className="badge bg-slate-100 text-slate-600">#{t}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[11px] text-slate-400">
                      创建于 {new Date(m.created_at).toLocaleDateString('zh-CN')}
                    </div>
                    <button
                      onClick={() => deleteMem(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

function TagEditorSmall({ tags, tagInput, setTags, setTagInput }: {
  tags: string[]; tagInput: string; setTags: (t: string[]) => void; setTagInput: (v: string) => void;
}) {
  const add = () => {
    const v = tagInput.trim().replace(/^#/, '');
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" /> 标签
      </label>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl2 border border-slate-200 bg-white min-h-[42px]">
        {tags.map(t => (
          <span key={t} className="badge bg-primary-50 text-primary-700">
            #{t}
            <button onClick={() => setTags(tags.filter(x => x !== t))} className="ml-0.5 hover:text-primary-900">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          }}
          placeholder="输入后回车添加"
          className="flex-1 bg-transparent outline-none text-sm min-w-[80px]"
        />
      </div>
    </div>
  );
}
