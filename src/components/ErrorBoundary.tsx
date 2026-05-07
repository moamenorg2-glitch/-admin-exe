import * as React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Import toast dynamically to avoid SSR issues if any, or just use it directly if imported
    import('react-hot-toast').then(({ toast }) => {
      toast.error('حدث خطأ في النظام: ' + error.message, { id: 'error-boundary', duration: 6000 });
    });

    // Recovery logic
    const errorMsg = error.message || '';
    const isDOMError = errorMsg.includes('removeChild') || 
                       errorMsg.includes('insertBefore') || 
                       errorMsg.includes('Node') ||
                       errorMsg.includes('null (reading \'parentNode\')');
                       
    // Use session storage to track recovery attempts to avoid infinite loops
    const recoveryCountKey = 'boundary_recovery_count';
    const recoveryCount = parseInt(sessionStorage.getItem(recoveryCountKey) || '0');

    if (isDOMError && recoveryCount < 3) {
      console.warn(`DOM inconsistency detected (Attempt ${recoveryCount + 1}). Attempting automatic recovery...`);
      sessionStorage.setItem(recoveryCountKey, (recoveryCount + 1).toString());
      
      // Reset the error state after a brief delay
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 300);
      
      // Reset the count after 5 seconds of stability
      setTimeout(() => {
        sessionStorage.setItem(recoveryCountKey, '0');
      }, 5000);
    }
  }

  render() {
    // If there's an error, we display a floating non-blocking UI and still try to render children
    // Wait, rendering children after error will cause an infinite loop if the error persists.
    // Instead we render the fallback box. If the user dismisses it, we reset state to try rendering again.
    if (this.state.hasError) {
      return (
        <div className="fixed inset-x-0 bottom-10 flex flex-col items-center justify-center p-4 z-[9999] pointer-events-none" dir="rtl">
          <div className="bg-[#1E1E2D] p-5 rounded-2xl shadow-2xl max-w-md w-full border-2 border-rose-500/50 flex flex-col pointer-events-auto relative animate-in slide-in-from-bottom-10">
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="absolute top-4 left-4 text-gray-400 hover:text-white bg-gray-800 p-1.5 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-rose-500/20 p-3 rounded-full">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">صندوق الأخطاء</h3>
                <p className="text-xs text-rose-400 font-mono mt-1 break-words line-clamp-2" title={this.state.error?.message}>
                  {this.state.error?.message}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-5 border-t border-gray-800 pt-3">
              حدثت مشكلة فنية. يمكنك إغلاق هذا الصندوق لمحاولة الاستمرار، أو إعادة تحميل الصفحة إذا بقيت المشكلة.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 py-2.5 text-sm bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors font-bold"
              >
                تجاهل وإغلاق
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem('boundary_recovery_count', '0');
                  window.location.reload();
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-500 py-2.5 rounded-xl hover:bg-emerald-600/30 transition-all font-bold text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة تحميل للصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
