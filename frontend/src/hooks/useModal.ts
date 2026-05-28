'use client';

import { useState, useCallback } from 'react';

export function useModal(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((s) => !s), []);

  return { isOpen, open, close, toggle, setIsOpen };
}

// Typed modal with data payload (e.g. for "edit" dialogs)
export function useModalWithData<T>(defaultData?: T) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | undefined>(defaultData);

  const open = useCallback((payload?: T) => {
    setData(payload);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Delay clearing data so the closing animation can finish
    setTimeout(() => setData(defaultData), 200);
  }, [defaultData]);

  return { isOpen, data, open, close, setIsOpen };
}
