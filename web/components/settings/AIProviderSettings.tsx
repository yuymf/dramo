'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAIProviders, switchAIProvider, type AIProvider } from '@/lib/api/ai-providers';

export function AIProviderSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await getAIProviders();
      setProviders(data.providers);
      setCurrentProvider(data.current);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setMessage({ type: 'error', text: '加载 AI 提供商列表失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProvider = async (providerName: string) => {
    if (providerName === currentProvider) {
      return;
    }

    try {
      setSwitching(true);
      setMessage(null);
      
      const result = await switchAIProvider(providerName as 'openai' | 'hunyuan');
      
      setMessage({
        type: 'success',
        text: `已切换到 ${providerName}。${result.note || '请重启服务以使更改生效。'}`,
      });
      
      // Reload providers to update status
      await loadProviders();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to switch provider:', err);
      setMessage({
        type: 'error',
        text: err.message || '切换 AI 提供商失败',
      });
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">AI 模型提供商</h2>
      
      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={`p-4 border rounded-lg transition-all ${
              provider.active
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-lg">{provider.display_name}</h3>
                  {provider.active && (
                    <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
                      当前使用
                    </span>
                  )}
                  {!provider.available && (
                    <span className="px-2 py-1 text-xs bg-gray-400 text-white rounded">
                      未配置
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">模型: {provider.model}</p>
              </div>
              
              <Button
                onClick={() => handleSwitchProvider(provider.name)}
                disabled={!provider.available || provider.active || switching}
                variant={provider.active ? 'default' : 'outline'}
              >
                {switching ? '切换中...' : provider.active ? '使用中' : '切换'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>注意：</strong>切换 AI 提供商后，需要重启 AgentOS 服务才能生效。
        </p>
      </div>
    </Card>
  );
}

