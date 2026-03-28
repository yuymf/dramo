"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type PageType = 'script' | 'characters' | 'locations' | 'storyboard' | null;

interface AIChatContextValue {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
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
  isOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
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
  // projectId 保留在 props 中以便将来使用，但目前从 URL 获取
  const [isOpen, setIsOpen] = useState(false);
  const [currentJsonData, setCurrentJsonData] = useState<object | null>(null);
  const [pendingChanges, setPendingChanges] = useState<AIChatContextValue['pendingChanges']>(null);
  const pathname = usePathname();

  // 根据路径判断当前页面类型
  const getPageType = useCallback((path: string | null): PageType => {
    if (!path) return null;
    if (path.includes('/scripts')) return 'script';
    if (path.includes('/characters')) return 'characters';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/storyboard')) return 'storyboard';
    return null;
  }, []);

  const currentPageType = getPageType(pathname);

  // 当页面切换时，清空待处理的修改
  useEffect(() => {
    if (pendingChanges && pendingChanges.type !== currentPageType) {
      setPendingChanges(null);
    }
  }, [currentPageType, pendingChanges]);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const updateJsonData = useCallback((data: object | null) => {
    setCurrentJsonData(data);
  }, []);

  const clearPendingChanges = useCallback(() => {
    setPendingChanges(null);
  }, []);

  const value: AIChatContextValue = useMemo(() => ({
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    currentPageType,
    currentJsonData,
    updateJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges,
  }), [
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
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

