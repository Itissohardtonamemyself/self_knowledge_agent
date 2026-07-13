import { useLocation, Link } from 'react-router-dom';
import { PanelLeft, Github, RefreshCw, Home } from 'lucide-react';
import { useAppStore } from '@/store';

const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  '/': { label: '仪表盘' },
  '/chat': { label: '智能对话' },
  '/documents': { label: '文档管理' },
  '/memory': { label: '记忆中心' },
  '/processing': { label: '知识处理' },
  '/maintenance': { label: '系统维护' },
  '/privacy': { label: '隐私安全' },
};

export default function Topbar() {
  const toggle = useAppStore((s) => s.toggleSidebar);
  const loc = useLocation();

  const crumbs = [{ path: '/', label: '首页' }];
  let matched = false;
  for (const p of Object.keys(BREADCRUMB_MAP)) {
    if (loc.pathname === p || (p !== '/' && loc.pathname.startsWith(p + '/'))) {
      crumbs.push({ path: p, label: BREADCRUMB_MAP[p].label });
      matched = true;
      break;
    }
  }
  if (!matched && loc.pathname !== '/') {
    crumbs.push({ path: loc.pathname, label: loc.pathname });
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          className="p-2 rounded-xl2 hover:bg-slate-100 transition-colors text-slate-600"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <nav className="flex items-center gap-2 text-sm text-slate-500 truncate">
          {crumbs.map((c, i) => (
            <div key={c.path + i} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-300">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="text-slate-800 font-medium flex items-center gap-1.5">
                  {i === 0 && <Home className="w-3.5 h-3.5" />}
                  {c.label}
                </span>
              ) : (
                <Link to={c.path} className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                  {i === 0 && <Home className="w-3.5 h-3.5" />}
                  {c.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-xl2 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
          title="刷新"
        >
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex btn-ghost !py-1.5 !px-3 text-xs"
        >
          <Github className="w-4 h-4" />
          API 文档
        </a>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
          <span className="text-xs font-medium text-slate-700">服务在线</span>
        </div>
      </div>
    </header>
  );
}
