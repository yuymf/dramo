"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type PageType = 'script' | 'characters' | 'locations' | 'storyboard' | null;

interface AIChatContextValue {
  currentPageType: PageType;
  currentJsonData: object | null;
  updateJsonData: (data: object | null) => void;
  pendingChanges: {
    type: PageType;
    originalData: object | null;
    suggestedData: object | null;
  } | null;
  setPendingChanges: (changes: AIChatContextValue['pendingChanges']) => void;
  clearPendingChanges: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

const noopAIChatContext: AIChatContextValue = {
  currentPageType: null,
  currentJsonData: null,
  updateJsonData: () => {},
  pendingChanges: null,
  setPendingChanges: () => {},
  clearPendingChanges: () => {},
};

export function useAIChat() {
  const context = useContext(AIChatContext);
  return context ?? noopAIChatContext;
}

interface AIChatProviderProps {
  children: ReactNode;
  projectId?: string;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [currentJsonData, setCurrentJsonData] = useState<object | null>(null);
  const [pendingChanges, setPendingChanges] = useState<AIChatContextValue['pendingChanges']>(null);
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

  useEffect(() => {
    if (pendingChanges && pendingChanges.type !== currentPageType) {
      setPendingChanges(null);
    }
  }, [currentPageType, pendingChanges]);

  const updateJsonData = useCallback((data: object | null) => {
    setCurrentJsonData(data);
  }, []);

  const clearPendingChanges = useCallback(() => {
    setPendingChanges(null);
  }, []);

  const value: AIChatContextValue = useMemo(() => ({
    currentPageType,
    currentJsonData,
    updateJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges,
  }), [
    currentPageType,
    currentJsonData,
    updateJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges,
  ]);

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
