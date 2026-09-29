import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#161616',
            borderRadius: '16px',
            border: '1px solid #282828',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#ef4444'
            }}>
              <AlertTriangle size={28} />
            </div>
            
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Something went wrong
            </h2>
            
            <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '20px', lineHeight: 1.5 }}>
              The application encountered an unexpected runtime error.
            </p>

            {this.state.error?.message && (
              <div style={{
                backgroundColor: '#0d0d0d',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #222222',
                fontSize: '13px',
                color: '#f87171',
                textAlign: 'left',
                marginBottom: '24px',
                fontFamily: 'monospace',
                wordBreak: 'break-word'
              }}>
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
