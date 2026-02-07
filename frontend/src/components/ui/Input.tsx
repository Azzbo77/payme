import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isValid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, isValid, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs text-charcoal-600 dark:text-sand-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-transparent border-b-2 px-1 py-2.5 md:py-2 text-base md:text-sm text-charcoal-900 dark:text-sand-100 focus:outline-none transition-colors placeholder:text-charcoal-400 dark:placeholder:text-charcoal-600 touch-manipulation ${
            error
              ? 'border-terracotta-500 dark:border-terracotta-400 focus:border-terracotta-600 dark:focus:border-terracotta-500'
              : isValid
              ? 'border-sage-500 dark:border-sage-400 focus:border-sage-600 dark:focus:border-sage-500'
              : 'border-sand-300 dark:border-charcoal-600 focus:border-sage-500 dark:focus:border-sage-400'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-terracotta-600 dark:text-terracotta-400 font-medium mt-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

