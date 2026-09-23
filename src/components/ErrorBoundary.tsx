import React, { Component } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  lang?: 'en' | 'ar';
  /** Called when the user taps retry (after the boundary resets). */
  onRetry?: () => void;
  /** Title shown above the message. Defaults to a library-specific title. */
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors and rejected lazy chunk imports below it so a
 * failure in one overlay can never blank the whole app. Shows a friendly
 * bilingual message with a retry button instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep this lightweight: surfaces in the device console for diagnosis.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      const ar = this.props.lang === 'ar';
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#f7f1e5] dark:bg-[#14100b] p-6">
          <div className="max-w-sm text-center">
            <div className="font-serif text-lg font-bold text-[#2b2118] dark:text-[#f5ebd9]">
              {this.props.title ?? (ar ? 'تعذّر فتح المكتبة القبطية' : 'Could not open the Coptic Library')}
            </div>
            <p className="mt-2 text-sm text-[#6b5a44] dark:text-[#a89379] font-serif leading-relaxed">
              {ar
                ? 'حدث خطأ أثناء تحميل المكتبة. تحقق من اتصال الإنترنت ثم حاول مجددًا.'
                : 'Something went wrong while loading the library. Check your internet connection and try again.'}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#b08d57] hover:bg-[#c09a63] text-white text-sm font-serif font-bold shadow-md transition-colors cursor-pointer"
            >
              {ar ? 'حاول مجددًا' : 'Try again'}
            </button>
            {this.state.error && (
              <p className="mt-4 text-[11px] leading-relaxed text-[#6b5a44]/70 dark:text-[#a89379]/70 break-words font-mono">
                {String((this.state.error as Error)?.message || this.state.error).slice(0, 300)}
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Retry a dynamic import a few times — mobile networks often blip once. */
export function importWithRetry<T>(importer: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  return importer().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<void>((res) => setTimeout(res, delayMs)).then(() =>
      importWithRetry(importer, retries - 1, delayMs),
    );
  });
}
