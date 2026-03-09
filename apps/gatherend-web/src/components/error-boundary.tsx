"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryFallbackProps {
  error: Error | null;
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onReset?: () => void;
  /**
   * Array de valores que, al cambiar, resetean automáticamente el error boundary.
   * Útil para SPA client-side navigation: cuando el usuario navega a otra vista,
   * el error boundary se limpia sin necesitar un cambio de `key` en el padre.
   */
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary para capturar errores en componentes hijos.
 * Muestra un fallback cuando ocurre un error en lugar de crashear la app.
 *
 * Soporta auto-reset via `resetKeys` — cuando cualquier valor en el array
 * cambia entre renders, el estado de error se limpia automáticamente.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error para debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-reset cuando resetKeys cambian (e.g., navegación SPA)
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys ?? [];
      const nextKeys = this.props.resetKeys;
      const hasChanged =
        prevKeys.length !== nextKeys.length ||
        nextKeys.some((key, i) => !Object.is(key, prevKeys[i]));

      if (hasChanged) {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      return this.props.fallback;
    }

    return this.props.children;
  }
}
