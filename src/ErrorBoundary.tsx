import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
            <h1 className="text-2xl font-bold">Algo salió mal.</h1>
            <p className="mt-2 text-gray-600">Por favor, recarga la página o contacta al soporte.</p>
            {this.state.error && (
              <pre className="mt-4 p-4 bg-red-50 text-red-800 text-xs text-left overflow-auto max-w-full">
                {this.state.error.stack || this.state.error.message}
              </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}
