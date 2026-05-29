'use client';

import { forwardRef } from 'react';
import { FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// ─── Base field wrapper ──────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?: string;
  error?: FieldError | { message?: string };
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

export function FieldWrapper({ label, error, hint, required, className, children, htmlFor }: FieldWrapperProps) {
  // Must match the `aria-describedby` the field inputs point at, so screen
  // readers actually announce the error when the field is focused.
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn('text-sm font-medium', error && 'text-destructive')}
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {error?.message && (
        <p id={errorId} className="text-xs text-destructive" role="alert">{error.message}</p>
      )}
      {hint && !error?.message && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── Text input field ────────────────────────────────────────────────────────

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: FieldError | { message?: string };
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, className, id, required, ...props }, ref) => {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
        <Input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error?.message ? `${fieldId}-error` : undefined}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          required={required}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
TextField.displayName = 'TextField';

// ─── Textarea field ──────────────────────────────────────────────────────────

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: FieldError | { message?: string };
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, className, id, required, ...props }, ref) => {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
        <Textarea
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error?.message ? `${fieldId}-error` : undefined}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          required={required}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
TextareaField.displayName = 'TextareaField';

// ─── Form section ────────────────────────────────────────────────────────────

export function FormSection({ title, description, children, className }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-4', className)}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

// ─── Form row (responsive grid) ──────────────────────────────────────────────

export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div className={cn(
      'grid gap-4',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-1 sm:grid-cols-2',
      cols === 3 && 'grid-cols-1 sm:grid-cols-3',
    )}>
      {children}
    </div>
  );
}
