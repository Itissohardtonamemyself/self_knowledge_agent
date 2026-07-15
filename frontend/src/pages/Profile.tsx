import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Settings, Save, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { UserOut } from '@/types';

export default function Profile() {
  const nav = useNavigate();
  const pushToast = useAppStore((s) => s.pushToast);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getUserInfo();
        setForm({
          name: res.name || '',
          email: res.email || '',
          phone: res.phone || '',
        });
      } catch (e: any) {
        pushToast('error', e.message || '获取用户信息失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone)) {
      newErrors.phone = '请输入有效的手机号';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const res = await api.updateUserInfo({
        name: form.name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      setUser(res);
      pushToast('success', '用户信息更新成功');
    } catch (e: any) {
      pushToast('error', e.message || '更新失败');
      if (e.code === 'PHONE_EXISTS') {
        setErrors({ phone: e.message });
      } else if (e.code === 'EMAIL_EXISTS') {
        setErrors({ email: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => nav(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-500" />
            个人中心
          </h1>
          <p className="text-sm text-slate-500">管理您的个人信息</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {user?.name || user?.username || '用户'}
            </h2>
            <p className="text-sm text-slate-500">@{user?.username}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">基本信息</h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
              <User className="w-5 h-5 text-slate-400" />
              <span className="text-slate-800">{user?.username}</span>
              <span className="text-xs text-slate-400 ml-auto">不可修改</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">姓名</label>
            <div className="relative">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入姓名"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="请输入邮箱"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.email
                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 focus:ring-primary-500/20 focus:border-primary-500'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">手机号</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                placeholder="请输入手机号"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.phone
                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 focus:ring-primary-500/20 focus:border-primary-500'
                }`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => nav(-1)}
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存
          </button>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">账号信息</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>账号状态</span>
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              正常
            </span>
          </div>
          <div className="flex justify-between">
            <span>用户角色</span>
            <span>{user?.is_admin ? '管理员' : '普通用户'}</span>
          </div>
          <div className="flex justify-between">
            <span>注册时间</span>
            <span>{user?.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>最后更新</span>
            <span>{user?.updated_at ? new Date(user.updated_at).toLocaleString('zh-CN') : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}