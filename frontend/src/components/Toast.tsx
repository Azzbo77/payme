import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Toast } from '../context/ToastContext';

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timerId = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300); // Match animation duration
      }, toast.duration);

      return () => clearTimeout(timerId);
    }
  }, [toast.duration, toast.id, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} className="text-white" />;
      case 'error':
        return <AlertCircle size={20} className="text-white" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-white" />;
      case 'info':
        return <Info size={20} className="text-white" />;
      default:
        return null;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-sage-600 dark:bg-sage-700 border-sage-700 dark:border-sage-600';
      case 'error':
        return 'bg-terracotta-600 dark:bg-terracotta-700 border-terracotta-700 dark:border-terracotta-600';
      case 'warning':
        return 'bg-amber-600 dark:bg-amber-700 border-amber-700 dark:border-amber-600';
      case 'info':
        return 'bg-blue-600 dark:bg-blue-700 border-blue-700 dark:border-blue-600';
      default:
        return 'bg-charcoal-600 dark:bg-charcoal-700 border-charcoal-700 dark:border-charcoal-600';
    }
  };

  const getTextColor = () => {
    return 'text-white';
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
        transition-all duration-300 ease-in-out
        ${getBackgroundColor()}
        ${getTextColor()}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity text-white"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-auto max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
