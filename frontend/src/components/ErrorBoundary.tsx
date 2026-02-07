import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches errors from child components and displays a graceful fallback
 * Prevents entire page from crashing if one section fails
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `Error in ${this.props.section || "component"}:`,
      error,
      errorInfo
    );
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback?.(this.state.error, this.reset) || (
          <div className="border border-terracotta-200 dark:border-terracotta-800 bg-terracotta-50 dark:bg-terracotta-900/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-terracotta-600 dark:text-terracotta-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-terracotta-900 dark:text-terracotta-200 mb-1">
                  Something went wrong
                </h3>
                <p className="text-sm text-terracotta-800 dark:text-terracotta-300 mb-3">
                  {this.props.section && `in ${this.props.section}: `}
                  {this.state.error.message || "An unexpected error occurred"}
                </p>
                <Button
                  onClick={this.reset}
                  variant="secondary"
                  size="sm"
                >
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
