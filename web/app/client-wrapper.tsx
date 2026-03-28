/**
 * Client-side wrapper for global error handling
 */
"use client";

import { useEffect } from 'react';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  // 全局错误处理：过滤浏览器扩展的错误
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    
    // 处理未捕获的 Promise 拒绝
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // 过滤浏览器扩展相关的错误
      if (
        error?.message?.includes('content_script') ||
        error?.message?.includes('Failed to fetch') ||
        error?.stack?.includes('content_script') ||
        typeof error === 'string' && error.includes('content_script')
      ) {
        // 静默处理浏览器扩展的错误，不显示在控制台
        event.preventDefault();
        console.debug('[App] Ignored browser extension error:', error);
        return;
      }
      
      // 其他错误正常处理
      console.error('[App] Unhandled promise rejection:', error);
    };
    
    // 处理全局错误
    const handleError = (event: ErrorEvent) => {
      const error = event.error || event.message;
      
      // 过滤浏览器扩展相关的错误
      if (
        error?.message?.includes('content_script') ||
        error?.stack?.includes('content_script') ||
        typeof error === 'string' && error.includes('content_script') ||
        event.filename?.includes('content_script')
      ) {
        // 静默处理浏览器扩展的错误
        event.preventDefault();
        console.debug('[App] Ignored browser extension error:', error);
        return;
      }
      
      // 其他错误正常处理
      console.error('[App] Global error:', error);
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  
  return <>{children}</>;
}

