import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

// Without this a render error anywhere blanks the whole app with no way back.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UI crash]', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
          <h1 className="text-base font-semibold text-gray-900 mb-1">Kuch ghalat ho gaya</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            Page load nahi ho saka. Reload karein; agar masla rahe to owner ko batayein.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition">
              Reload
            </button>
            <a href="/dashboard" className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
              Dashboard
            </a>
          </div>
          <p className="mt-4 text-[11px] text-gray-400 font-mono break-all">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
