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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
          <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full text-center border border-gray-100">
            <div className="flex justify-center mb-8">
              <div className="bg-red-50 p-6 rounded-full">
                <AlertTriangle className="h-16 w-16 text-red-500" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-4">عذراً، حدث خطأ تقني</h1>
            <p className="text-gray-500 mb-10 leading-relaxed font-medium">
              {this.state.error?.message || 'واجه النظام مشكلة غير متوقعة. يرجى محاولة تحديث الصفحة.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white py-4 px-6 rounded-2xl hover:bg-emerald-700 transition-all font-black shadow-lg shadow-emerald-100"
            >
              <RefreshCw className="w-6 h-6" />
              تحديث الصفحة الآن
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
