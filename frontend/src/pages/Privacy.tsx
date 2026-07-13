import { useState } from 'react';
import {
  LockKeyhole,
  FileDown,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  StepForward,
  Check,
  FileOutput,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';

export default function Privacy() {
  const push = useAppStore((s) => s.pushToast);

  // Export
  const [exportDir, setExportDir] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{ path: string; size: number; files: string[]; time: string } | null>(null);

  // Wipe
  const [step, setStep] = useState(0); // 0: idle, 1: confirm text, 2: double checkbox, 3: running
  const [confirmText, setConfirmText] = useState('');
  const [wipeCheck1, setWipeCheck1] = useState(false);
  const [wipeCheck2, setWipeCheck2] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<any>(null);

  // Mask
  const [rawText, setRawText] = useState('');
  const [maskedText, setMaskedText] = useState('');
  const [masking, setMasking] = useState(false);
  const [showRaw, setShowRaw] = useState(true);
  const [copied, setCopied] = useState(false);

  const runExport = async () => {
    setExporting(true);
    try {
      const r = await api.exportAll(exportDir.trim() || undefined);
      const path = r.export_path || r.path || '';
      setLastExport({
        path,
        size: r.size_bytes || 0,
        files: r.files || [],
        time: r.created_at || new Date().toLocaleString(),
      });
      push('success', r.message || '数据已导出');
    } catch (e: any) {
      push('error', e.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const downloadLast = () => {
    if (!lastExport?.path) return;
    window.open(api.downloadExport(lastExport.path), '_blank');
  };

  const runMask = async () => {
    if (!rawText.trim()) return;
    setMasking(true);
    try {
      const r = await api.maskText(rawText);
      setMaskedText(typeof r === 'string' ? r : (r.text || String(r)));
    } catch (e: any) {
      push('error', e.message || '脱敏失败');
    } finally {
      setMasking(false);
    }
  };

  const copyMasked = async () => {
    if (!maskedText) return;
    try {
      await navigator.clipboard.writeText(maskedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { push('info', '复制失败，请手动选择复制'); }
  };

  const runWipe = async () => {
    if (confirmText.trim() !== '确认擦除所有数据') { push('info', '请在输入框准确输入：确认擦除所有数据'); return; }
    if (!wipeCheck1 || !wipeCheck2) { push('info', '请勾选全部确认项'); return; }
    if (!confirm('⚠️ 最后确认：你即将永久删除全部个人数据，此操作无法撤销。\n\n确定继续吗？')) return;
    setStep(3);
    setWiping(true);
    try {
      const r = await api.wipeAll(true);
      setWipeResult(r);
      push('success', '数据已全部擦除');
      setTimeout(() => { setStep(0); setConfirmText(''); setWipeCheck1(false); setWipeCheck2(false); }, 3000);
    } catch (e: any) {
      push('error', e.message || '擦除失败');
      setStep(0);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="card p-5 bg-gradient-to-br from-violet-50 via-white to-red-50 border-violet-100 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0">
            <LockKeyhole className="w-7 h-7 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl font-bold text-slate-900">隐私与数据主权</h1>
            <p className="mt-1 text-sm text-slate-500">
              你的数据 100% 存储在本地设备。你可以随时导出备份、脱敏处理或彻底擦除所有个人知识。
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">本地优先 · 无云端上传</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileOutput className="w-5 h-5 text-primary-600" />
              <h2 className="font-serif text-lg font-bold text-slate-800">导出个人数据</h2>
              <span className="badge bg-primary-50 text-primary-700 ml-auto">GDPR 便携权</span>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100 text-sm text-slate-700 leading-relaxed">
                将打包导出以下内容为 ZIP 文件：
                <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-slate-600">
                  <li>文档元数据与原始文件引用</li>
                  <li>全部对话历史（含问答记录）</li>
                  <li>用户画像与长期记忆条目</li>
                  <li>标签与向量索引摘要（JSON）</li>
                </ul>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">自定义导出目录（可选，留空用默认）</label>
                  <input className="input" value={exportDir} onChange={(e) => setExportDir(e.target.value)} placeholder="例如：D:/ska_exports / /home/user/exports" />
                </div>
                <div className="flex items-end">
                  <button onClick={runExport} disabled={exporting} className="btn-primary w-full !py-2.5">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {exporting ? '打包中…' : '生成导出包'}
                  </button>
                </div>
              </div>
              {lastExport && (
                <div className="rounded-xl p-4 bg-gradient-to-r from-emerald-50 to-primary-50 border border-emerald-200 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800">导出成功！</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate" title={lastExport.path}>
                      路径：{lastExport.path}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {lastExport.files.length} 个文件 · {(lastExport.size / 1024 / 1024).toFixed(2)} MB · {lastExport.time}
                    </div>
                  </div>
                  <button onClick={downloadLast} className="btn-accent !py-1.5 !px-3 text-xs whitespace-nowrap">
                    <Download className="w-3.5 h-3.5" /> 下载 ZIP
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-accent-600" />
              <h2 className="font-serif text-lg font-bold text-slate-800">文本脱敏工具</h2>
              <span className="badge bg-accent-50 text-accent-700 ml-auto">手机号/邮箱/身份证/姓名</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> 原始文本
                  </label>
                  <button onClick={() => setShowRaw(v => !v)} className="text-[11px] text-slate-400 hover:text-slate-600">
                    {showRaw ? <><EyeOff className="w-3 h-3 inline mr-1" />隐藏</> : <><Eye className="w-3 h-3 inline mr-1" />显示</>}
                  </button>
                </div>
                <textarea
                  rows={10}
                  className={`input font-mono text-[12px] resize-none ${!showRaw ? 'text-transparent selection:text-black selection:bg-primary-200' : ''}`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`粘贴要脱敏的文本，例如：\n我的手机号是13800138000，邮箱zhangsan@example.com\n身份证号110101199003075678，姓名张三`}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 脱敏结果
                  </label>
                  <button onClick={copyMasked} disabled={!maskedText} className="text-[11px] text-slate-400 hover:text-slate-600 disabled:opacity-40">
                    {copied ? <><Check className="w-3 h-3 inline mr-1 text-emerald-500" />已复制</> : <><Copy className="w-3 h-3 inline mr-1" />复制</>}
                  </button>
                </div>
                <div className="relative rounded-xl2 border border-slate-200 bg-slate-50 p-3 min-h-[256px] overflow-auto">
                  {maskedText ? (
                    <pre className="font-mono text-[12px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{maskedText}</pre>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-xs text-slate-400 p-4">
                      <ShieldCheck className="w-8 h-8 mb-2 text-slate-300" />
                      点击下方「脱敏处理」按钮
                      <br />敏感信息将被替换为 *** 或 [类型]
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="badge bg-red-50 text-red-600">📱 手机号 → ***</span>
                <span className="badge bg-primary-50 text-primary-600">📧 邮箱 → ***</span>
                <span className="badge bg-accent-50 text-accent-600">🆔 身份证号 → ***</span>
                <span className="badge bg-violet-50 text-violet-600">👤 姓名 → 某*</span>
              </div>
              <button onClick={runMask} disabled={!rawText.trim() || masking} className="btn-accent">
                {masking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {masking ? '处理中…' : '脱敏处理'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className={`card p-5 border-2 ${step >= 1 ? 'border-red-300' : 'border-slate-100'} bg-gradient-to-br from-red-50/60 via-white to-amber-50/50`}>
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="font-serif text-lg font-bold text-slate-900">擦除所有个人数据</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              将清空 SQLite 数据表、删除 Chroma 向量集合、移除文档索引记录。此操作不可逆，请务必先导出备份！
            </p>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-1 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step >= i ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step > i || (wipeResult && i === 3) ? <Check className="w-4 h-4" /> : i}
                    </div>
                    {i < 3 && <div className={`flex-1 h-0.5 rounded ${step > i ? 'bg-red-500' : 'bg-slate-200'}`} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 px-1">
                <span>输入确认语</span>
                <span>勾选双重确认</span>
                <span>执行擦除</span>
              </div>
            </div>

            {step === 3 ? (
              wiping || wipeResult ? (
                <div className={`rounded-xl p-6 text-center ${wipeResult ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                  {wiping ? (
                    <>
                      <Loader2 className="w-10 h-10 text-red-500 animate-spin mx-auto mb-3" />
                      <div className="font-semibold text-slate-700">正在擦除数据…</div>
                      <div className="text-xs text-slate-500 mt-1">清理 SQLite 表 → 删除向量集合 → 验证结果</div>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                      <div className="font-semibold text-emerald-700">擦除完成！</div>
                      <div className="text-xs text-slate-500 mt-1">
                        已清空 {wipeResult?.wiped_tables?.length || 0} 张表、{wipeResult?.wiped_collections?.length || 0} 个向量集合
                      </div>
                    </>
                  )}
                </div>
              ) : null
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <StepForward className="w-3.5 h-3.5 text-red-500" />
                    请准确输入下方字样以确认：
                    <span className="ml-auto font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                      确认擦除所有数据
                    </span>
                  </label>
                  <input
                    className="input"
                    value={confirmText}
                    onChange={(e) => { setConfirmText(e.target.value); if (e.target.value.trim() === '确认擦除所有数据') setStep(1); else setStep(0); }}
                    placeholder="请输入：确认擦除所有数据"
                  />
                </div>

                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    wipeCheck1 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 hover:border-red-200'
                  }`}>
                    <input type="checkbox" checked={wipeCheck1} onChange={(e) => { setWipeCheck1(e.target.checked); if (e.target.checked && wipeCheck2 && step >= 1) setStep(2); else if (step === 2) setStep(1); }} className="mt-1 w-4 h-4 text-red-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        我确认已导出并保存过重要数据的备份
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">未备份的内容擦除后无法恢复</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    wipeCheck2 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 hover:border-red-200'
                  }`}>
                    <input type="checkbox" checked={wipeCheck2} onChange={(e) => { setWipeCheck2(e.target.checked); if (e.target.checked && wipeCheck1 && step >= 1) setStep(2); else if (step === 2) setStep(1); }} className="mt-1 w-4 h-4 text-red-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">我明确知晓此操作不可逆</div>
                      <div className="text-xs text-slate-500 mt-0.5">所有文档、对话、记忆、画像将被永久删除</div>
                    </div>
                  </label>
                </div>

                <button
                  onClick={runWipe}
                  disabled={step < 2 || wiping}
                  className="btn-danger w-full disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {step < 2 ? '请先完成上方确认步骤' : '⚠️ 永久删除全部个人数据'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
