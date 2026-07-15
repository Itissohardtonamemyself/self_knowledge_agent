import { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, CheckCircle, Edit3, Save, X, Shield, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { UserOut } from '@/types';

export default function UserDetail() {
  const pushToast = useAppStore((s) => s.pushToast);
  const setUser = useAppStore((s) => s.setUser);
  const [user, setUserState] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    name: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getUserDetail();
        setUserState(data);
        setForm({
          username: data.username,
          email: data.email || '',
          phone: data.phone || '',
          name: data.name || '',
        });
      } catch (e: any) {
        pushToast('error', e.message || '获取用户信息失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateUser(form);
      setUserState(updated);
      setUser(updated);
      setIsEditing(false);
      pushToast('success', '用户信息更新成功');
    } catch (e: any) {
      pushToast('error', e.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email || '',
        phone: user.phone || '',
        name: user.name || '',
      });
    }
    setIsEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="card p-6 lg:p-8 bg-gradient-to-br from-primary-50 via-white to-accent-50 border-primary-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white shadow-lg">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-slate-900">个人中心</h1>
              <p className="mt-1 text-sm text-slate-600">管理您的个人信息和账户设置</p>
            </div>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary flex items-center gap-2 !px-5 !py-2.5"
            >
              <Edit3 className="w-4.5 h-4.5" /> 编辑信息
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                className="btn-ghost flex items-center gap-2 !px-5 !py-2.5"
              >
                <X className="w-4.5 h-4.5" /> 取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 !px-5 !py-2.5"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4.5 h-4.5" />
                )}
                保存
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary-600" /> 基本信息
        </h2>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> 用户名
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input"
                  placeholder="请输入用户名"
                />
              ) : (
                <div className="text-slate-900 bg-slate-50 rounded-xl px-4 py-3">
                  {user?.username}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> 姓名
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="请输入姓名"
                />
              ) : (
                <div className="text-slate-900 bg-slate-50 rounded-xl px-4 py-3">
                  {user?.name || '未设置'}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> 邮箱
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  placeholder="请输入邮箱"
                />
              ) : (
                <div className="text-slate-900 bg-slate-50 rounded-xl px-4 py-3">
                  {user?.email || '未绑定'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> 联系电话
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input"
                  placeholder="请输入手机号"
                />
              ) : (
                <div className="text-slate-900 bg-slate-50 rounded-xl px-4 py-3">
                  {user?.phone || '未绑定'}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-serif text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" /> 账户状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium mb-1">用户ID</div>
            <div className="text-slate-900 font-semibold">{user?.id}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium mb-1">注册时间</div>
            <div className="text-slate-900 font-semibold text-sm">{user?.created_at ? formatDate(user.created_at) : '-'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium mb-1">最近更新</div>
            <div className="text-slate-900 font-semibold text-sm">{user?.updated_at ? formatDate(user.updated_at) : '-'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium mb-1">账户状态</div>
            <div className="flex items-center gap-2">
              {user?.is_active ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-700 font-semibold">正常</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 font-semibold">已禁用</span>
                </>
              )}
            </div>
          </div>
        </div>
        {user?.is_admin && (
          <div className="mt-4 bg-amber-50 rounded-xl p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-500" />
            <span className="text-amber-800 font-medium">此账户为管理员账户</span>
          </div>
        )}
      </section>
    </div>
  );
}