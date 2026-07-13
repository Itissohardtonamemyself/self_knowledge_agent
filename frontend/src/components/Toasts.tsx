import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/store';

export default function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-[min(360px,calc(100vw-2rem))]">
      {toasts.map((t) => {
        const colors =
          t.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : t.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-primary-50 border-primary-200 text-primary-800';
        const Icon =
          t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : AlertCircle;
        return (
          <div
            key={t.id}
            className={`card px-4 py-3 flex items-start gap-3 border ${colors} animate-slide-up`}
          >
            <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm font-medium min-w-0 break-words">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 -mr-1 -mt-1 rounded hover:bg-black/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
