import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-canvas text-ink">
          <div className="text-[18px] font-semibold">页面出错了</div>
          <div className="max-w-md rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-[12px] text-danger">
            {this.state.error?.message ?? '未知错误'}
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md bg-ink px-4 py-2 text-[13px] text-canvas hover:bg-ink/90"
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
