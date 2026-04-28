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
        <div className="min-h-screen flex items-center justify-center bg-[#151521] p-4 text-right" dir="rtl">
          <div className="bg-[#1E1E2D] p-10 rounded-[2rem] shadow-2xl max-w-lg w-full text-center border border-gray-800">
            <div className="flex justify-center mb-8">
              <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20">
                <AlertTriangle className="h-16 w-16 text-red-500" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-white mb-4">عذراً، حدث خطأ تقني</h1>
            <p className="text-gray-400 mb-10 leading-relaxed font-medium">
              واجه النظام مشكلة في مزامنة البيانات. يرجى الضغط على زر التحديث لاستكمال العمل.
            </p>
            <button
              onClick={() => {
                sessionStorage.setItem('boundary_recovery_count', '0');
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white py-4 px-6 rounded-2xl hover:bg-emerald-700 transition-all font-black shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className="w-6 h-6" />
              تحديث واجهة التطبيق
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
