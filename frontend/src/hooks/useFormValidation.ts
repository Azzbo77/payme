import { useState, useCallback } from 'react';

export interface ValidationRule {
  validate: (value: string | number) => boolean;
  message: string;
}

export interface FormField {
  value: string | number;
  error?: string;
  isValid: boolean;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

export function useFormValidation(rules: Record<string, ValidationRule[]>) {
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const validateField = useCallback((fieldName: string, value: string | number) => {
    const fieldRules = rules[fieldName];
    if (!fieldRules) return '';

    for (const rule of fieldRules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
    return '';
  }, [rules]);

  const validateAll = useCallback((values: Record<string, string | number>) => {
    const errors: FormErrors = {};
    let isValid = true;

    Object.keys(rules).forEach((fieldName) => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        errors[fieldName] = error;
        isValid = false;
      }
    });

    setFieldErrors(errors);
    return isValid;
  }, [rules, validateField]);

  const clearField = useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    fieldErrors,
    validateField,
    validateAll,
    clearField,
    clearAll,
  };
}

// Common validation rules
export const validationRules = {
  required: (fieldName: string): ValidationRule => ({
    validate: (value) => {
      const str = String(value).trim();
      return str.length > 0;
    },
    message: `${fieldName} is required`,
  }),

  minLength: (fieldName: string, length: number): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== 'string') return true;
      return value.length >= length;
    },
    message: `${fieldName} must be at least ${length} characters`,
  }),

  positive: (fieldName: string): ValidationRule => ({
    validate: (value) => {
      const num = parseFloat(String(value));
      return !isNaN(num) && num > 0;
    },
    message: `${fieldName} must be a positive number`,
  }),

  nonNegative: (fieldName: string): ValidationRule => ({
    validate: (value) => {
      const num = parseFloat(String(value));
      return !isNaN(num) && num >= 0;
    },
    message: `${fieldName} must be zero or positive`,
  }),

  email: (): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== 'string') return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    message: 'Invalid email address',
  }),
};
