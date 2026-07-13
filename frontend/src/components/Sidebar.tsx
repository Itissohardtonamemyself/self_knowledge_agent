import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Brain,
  Cpu,
  Shield,
  LockKeyhole,
  BookOpen,
  PanelLeft,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';

const NAV = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard, emoji: '🏠' },
  { path: '/chat', label: '智能对话', icon: MessageSquare, emoji: '💬' },
  { path: '/documents', label: '文档管理', icon: FolderKanban, emoji: '📚' },
  { path: '/memory', label: '记忆中心', icon: Brain, emoji: '🧠' },
  { path: '/processing', label: '知识处理', icon: Cpu, emoji: '⚙️' },
  { path: '/maintenance', label: '系统维护', icon: Shield, emoji: '🛡️' },
  { path: '/privacy', label: '隐私安全', icon: LockKeyhole, emoji: '🔐' },
];

export default function Sidebar() {
  const open = useAppStore((s) => s.sidebarOpen);
  const setOpen = useAppStore((s) => s.setSidebar);
  const loc = useLocation();

  const isActive = (p: string) => {
    if (p === '/') return loc.pathname === '/';
    return loc.pathname === p || loc.pathname.startsWith(p + '/');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[260px] h-full bg-white border-r border-slate-100 shadow-sm flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:w-[72px]'
        }`}
      >
        <div className={`h-16 flex items-center ${open ? 'px-5 justify-between' : 'justify-center'} border-b border-slate-100`}>
          {open ? (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="font-serif font-bold text-base text-slate-800 leading-tight">知伴</div>
                <div className="text-[10px] text-slate-400 leading-none">Self Knowledge</div>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen(false)}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && setOpen(false)}
                className={active ? 'sidebar-item-active' : 'sidebar-item'}
                title={!open ? item.label : undefined}
              >
                <span className="text-base leading-none w-6 flex-shrink-0 text-center">
                  {active ? <Icon className="w-5 h-5 mx-auto" /> : <Icon className="w-5 h-5 mx-auto" />}
                </span>
                {open && <span className="flex-1">{item.label}</span>}
                {open && <span className="text-xs opacity-60">{item.emoji}</span>}
              </NavLink>
            );
          })}
        </nav>

        {open && (
          <div className="p-3 border-t border-slate-100">
            <div className="card p-3 bg-gradient-to-br from-primary-50 to-accent-50 border-primary-100">
              <div className="flex items-start gap-2">
                <span className="text-lg">✨</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700">本地优先</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    所有数据存储在本地，数据主权在你手中
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
