"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type PageType = 'script' | 'characters' | 'locations' | 'storyboard' | null;

interface AIChatContextValue {
  currentPageType: PageType;
  currentJsonData: object | null;
  updateJsonData: (data: object | null) => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

const noopAIChatContext: AIChatContextValue = {
  currentPageType: null,
  currentJsonData: null,
  updateJsonData: () => {},
};

export function useAIChat() {
  const context = useContext(AIChatContext);
  return context ?? noopAIChatContext;
}

interface AIChatProviderProps {
  children: ReactNode;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [currentJsonData, setCurrentJsonData] = useState<object | null>(null);
  const pathname = usePathname();

  const getPageType = useCallback((path: string | null): PageType => {
    if (!path) return null;
    if (path.includes('/scripts')) return 'script';
    if (path.includes('/characters')) return 'characters';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/storyboard')) return 'storyboard';
    return null;
  }, []);

  const currentPageType = getPageType(pathname);

  const updateJsonData = useCallback((data: object | null) => {
    setCurrentJsonData(data);
  }, []);

  const value: AIChatContextValue = useMemo(() => ({
    currentPageType,
    currentJsonData,
    updateJsonData,
  }), [
    currentPageType,
    currentJsonData,
    updateJsonData,
  ]);

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
