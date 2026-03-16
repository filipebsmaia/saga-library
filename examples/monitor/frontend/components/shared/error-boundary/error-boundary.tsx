"use client";

import { Component, ReactNode } from "react";
import styles from "./error-boundary.module.scss";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className={styles.container}>
          <div className={styles.icon}>⚠</div>
          <h3 className={styles.title}>Something went wrong</h3>
          <p className={styles.message}>{this.state.error?.message}</p>
          <button className={styles.retry} onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
