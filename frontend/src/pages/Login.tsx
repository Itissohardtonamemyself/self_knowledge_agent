import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Phone, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { LoginResponse } from '@/types';

export default function Login() {
  const navigate = useNavigate();
  const loginAction = useAppStore((s) => s.login);
  const pushToast = useAppStore((s) => s.pushToast);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: '',
    password: '',
    phone: '',
    email: '',
    name: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetErrors = () => setErrors({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      let result: LoginResponse;
      if (isRegister) {
        if (!form.username) {
          setErrors({ username: '请输入用户名' });
          return;
        }
        if (!form.password) {
          setErrors({ password: '请输入密码' });
          return;
        }
        if (form.password.length < 6) {
          setErrors({ password: '密码至少需要6位' });
          return;
        }
        if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone)) {
          setErrors({ phone: '请输入有效的手机号' });
          return;
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
          setErrors({ email: '请输入有效的邮箱地址' });
          return;
        }
        result = await api.register({
          username: form.username,
          password: form.password,
          phone: form.phone || undefined,
          email: form.email || undefined,
          name: form.name || undefined,
        });
        pushToast('success', '注册成功');
      } else {
        if (!form.username) {
          setErrors({ username: '请输入用户名、邮箱或手机号' });
          return;
        }
        if (!form.password) {
          setErrors({ password: '请输入密码' });
          return;
        }
        if (form.password.length < 6) {
          setErrors({ password: '密码至少需要6位' });
          return;
        }
        result = await api.login({
          username_or_email_or_phone: form.username,
          password: form.password,
        });
        pushToast('success', '登录成功');
      }
      loginAction(result.user, result.token);
      navigate('/');
    } catch (err: any) {
      const code = err.code || 'UNKNOWN';
      const message = err.message || '操作失败';
      pushToast('error', message);
      if (code === 'USER_NOT_FOUND') {
        setErrors({ username: message });
      } else if (code === 'INVALID_PASSWORD') {
        setErrors({ password: message });
      } else if (code === 'USER_EXISTS') {
        setErrors({ username: message });
      } else if (code === 'PHONE_EXISTS') {
        setErrors({ phone: message });
      } else if (code === 'EMAIL_EXISTS') {
        setErrors({ email: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const isPhone = (value: string) => /^1[3-9]\d{9}$/.test(value);
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-br from-primary-200/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-br from-accent-200/30 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="card p-8 shadow-card-hover border-primary-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-slate-900">
              {isRegister ? '创建账户' : '欢迎回来'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isRegister ? '注册以使用你的个人知识库' : '登录到你的数字知识伙伴'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {isRegister ? '用户名' : '用户名 / 邮箱 / 手机号'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => {
                    setForm({ ...form, username: e.target.value });
                    if (errors.username) setErrors({ ...errors, username: '' });
                  }}
                  placeholder={isRegister ? '请输入用户名' : '请输入用户名、邮箱或手机号'}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.username
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-slate-200 focus:ring-primary-500/20 focus:border-primary-500'
                  }`}
                />
              </div>
              {errors.username && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.username}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  placeholder="请输入密码（至少6位）"
                  className={`w-full pl-11 pr-12 py-3 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.password
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-slate-200 focus:ring-primary-500/20 focus:border-primary-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.password}
                </p>
              )}
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">手机号（可选）</label>
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">邮箱（可选）</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">姓名（可选）</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="请输入姓名"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-primary-700 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? '注册' : '登录'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setForm({ username: '', password: '', phone: '', email: '', name: '' });
              }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              {isRegister
                ? '已有账户？立即登录'
                : '还没有账户？注册新账户'}
            </button>
          </div>

          {!isRegister && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-center text-slate-400">
                支持使用用户名、邮箱或手机号登录
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 Self Knowledge Agent. 你的数字知识伙伴
        </p>
      </div>
    </div>
  );
}