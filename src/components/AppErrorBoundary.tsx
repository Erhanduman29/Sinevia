import { Component } from 'react';
import type { ReactNode } from 'react';
import ErrorScreen from './ErrorScreen';

interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Hata ekranından ana sayfaya dönüş (verilirse buton gösterilir) */
  onHome?: () => void;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Sayfa seviyesi hata yakalayıcı: render hatasında boş/siyah ekran yerine
 * 500 kodlu kurtarma ekranı gösterir. "Yeniden Dene" ile tekrar dener.
 * Tek sekme hatasının tüm uygulamayı öldürmesini engeller (Layout kalır).
 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Konsol kaydı: hata kodu / stack bilgisi teşhis için
    console.error('[Sinevia] Sayfa hatasi yakalandi:', error, info?.componentStack ?? '');
  }

  render() {
    if (this.state.error) {
      return <ErrorScreen code={500} onRetry={() => this.setState({ error: null })} onHome={this.props.onHome} />;
    }
    return this.props.children;
  }
}
