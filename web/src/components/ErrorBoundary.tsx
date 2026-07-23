"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

/** Class boundary for client islands that should not take down the whole shell. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass-panel p-6 text-center">
          <p className="font-display text-lg text-white">
            {this.props.fallbackTitle || "This panel crashed"}
          </p>
          <p className="mt-2 text-sm text-white/60">{this.state.error.message}</p>
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
