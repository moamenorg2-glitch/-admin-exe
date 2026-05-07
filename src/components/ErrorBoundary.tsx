import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#111118]" dir="rtl">
          <div className="bg-[#1E1E2D] p-6 rounded-2xl shadow-xl max-w-sm w-full border border-rose-500/30 flex flex-col items-center">
            <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">صندوق الأخطاء</h3>
            <p className="text-sm text-gray-400 mb-6 text-center">
              حدث مشكلة ما، يمكنك إعادة تحميل الصفحة للعودة.
            </p>
            <button
              onClick={() => {
                sessionStorage.setItem('boundary_recovery_count', '0');
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-500 py-3 rounded-xl hover:bg-emerald-600/30 transition-all font-bold"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث الواجهة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
