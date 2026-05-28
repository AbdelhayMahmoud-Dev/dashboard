'use client';

import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
}

export function useConfirm(options: ConfirmOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((): Promise<boolean> => {
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolver?.(true);
    setResolver(null);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolver?.(false);
    setResolver(null);
  }, [resolver]);

  return {
    confirm,
    dialogProps: {
      open: isOpen,
      onOpenChange: (open: boolean) => { if (!open) handleCancel(); },
      onConfirm: handleConfirm,
      ...options,
    },
  };
}
