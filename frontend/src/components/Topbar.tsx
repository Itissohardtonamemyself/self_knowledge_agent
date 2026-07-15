import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { PanelLeft, Github, RefreshCw, Home, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';

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
  const logout = useAppStore((s) => s.logout);
  const pushToast = useAppStore((s) => s.pushToast);
  const user = useAppStore((s) => s.user);
  const loc = useLocation();
  const nav = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
    } finally {
      logout();
      pushToast('success', '已安全登出');
      nav('/login');
      setLoggingOut(false);
    }
  };

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

        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-700"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {user.name || user.username}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900">{user.name || user.username}</p>
                  <p className="text-xs text-slate-500">{user.email || user.phone || '未绑定联系方式'}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  个人中心
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
                >
                  {loggingOut ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  登出
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
