'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Eye,
  EyeOff,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listLLMConfigs,
  createLLMConfig,
  updateLLMConfig,
  deleteLLMConfig,
  setDefaultLLMConfig,
  verifyLLMConfig,
  type LLMConfig,
  type LLMConfigType,
  type CreateLLMConfigInput,
} from '@/lib/api/llm-configs';

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const CONFIG_TYPE_LABELS: Record<LLMConfigType, string> = {
  TEXT_LLM: '文本生成',
  IMAGE_GEN: '图片生成',
};

const CONFIG_TYPE_DESCRIPTIONS: Record<LLMConfigType, string> = {
  TEXT_LLM: '用于剧本生成、角色提取、场景分析等文本 AI 任务',
  IMAGE_GEN: '用于分镜图、角色立绘、场景图等图片生成任务',
};

const PRESET_PROVIDERS = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    name: 'Moonshot (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    name: '自定义 OpenAI 兼容',
    baseUrl: '',
    models: [],
    keyPrefix: '',
    docsUrl: '',
  },
] as const;

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'default' | 'active' | 'none' }) {
  if (status === 'default') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ background: 'rgba(212, 101, 74, 0.1)', color: 'var(--persimmon)' }}>
        <Star className="w-3 h-3" />
        默认
      </span>
    );
  }
  return null;
}

function TypeBadge({ type }: { type: LLMConfigType }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide"
      style={{
        background: type === 'TEXT_LLM' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(168, 85, 247, 0.08)',
        color: type === 'TEXT_LLM' ? '#2563eb' : '#a855f7',
      }}>
      {CONFIG_TYPE_LABELS[type]}
    </span>
  );
}

function VerifyBadge({ result }: { result: { success: boolean; latencyMs?: number; error?: string } | null }) {
  if (!result) return null;

  if (result.success) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--at-success)' }}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        连接成功{result.latencyMs ? ` (${result.latencyMs}ms)` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--at-error)' }}>
      <XCircle className="w-3.5 h-3.5" />
      {result.error || '连接失败'}
    </span>
  );
}

// ────────────────────────────────────────────────────────
// Config Card
// ────────────────────────────────────────────────────────

function ConfigCard({
  config,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  config: LLMConfig;
  onEdit: (config: LLMConfig) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`确定要删除配置「${config.name}」吗？`)) return;
    setDeleting(true);
    try {
      await onDelete(config.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async () => {
    setSettingDefault(true);
    try {
      await onSetDefault(config.id);
    } finally {
      setSettingDefault(false);
    }
  };

  return (
    <div className="ink-card p-5 group">
      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink-black)' }}>
              {config.name}
            </h3>
            <TypeBadge type={config.type} />
            <StatusBadge status={config.isDefault ? 'default' : 'none'} />
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!config.isDefault && (
              <button
                onClick={handleSetDefault}
                disabled={settingDefault}
                className="ink-toolbar-btn"
                title="设为默认"
              >
                {settingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={() => onEdit(config)} className="ink-toolbar-btn" title="编辑">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="ink-toolbar-btn hover:!text-red-600 hover:!bg-red-50"
              title="删除"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-wash)' }}>
            <span className="shrink-0" style={{ color: 'var(--ink-light)', width: '52px' }}>端点</span>
            <span className="truncate font-mono text-xs" style={{ color: 'var(--ink-wash)' }}>
              {config.baseUrl}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-wash)' }}>
            <span className="shrink-0" style={{ color: 'var(--ink-light)', width: '52px' }}>密钥</span>
            <span className="font-mono text-xs" style={{ color: 'var(--ink-light)' }}>
              {config.apiKey}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-wash)' }}>
            <span className="shrink-0" style={{ color: 'var(--ink-light)', width: '52px' }}>模型</span>
            <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink-black)' }}>
              {config.modelId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Config Form (Create / Edit)
// ────────────────────────────────────────────────────────

interface ConfigFormProps {
  editConfig?: LLMConfig | null;
  onSave: () => void;
  onCancel: () => void;
}

function ConfigForm({ editConfig, onSave, onCancel }: ConfigFormProps) {
  const isEdit = !!editConfig;

  const [name, setName] = useState(editConfig?.name ?? '');
  const [type, setType] = useState<LLMConfigType>(editConfig?.type ?? 'TEXT_LLM');
  const [baseUrl, setBaseUrl] = useState(editConfig?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(editConfig?.modelId ?? '');
  const [isDefault, setIsDefault] = useState(editConfig?.isDefault ?? false);
  const [showKey, setShowKey] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect preset from existing baseUrl
  useEffect(() => {
    if (editConfig?.baseUrl) {
      const idx = PRESET_PROVIDERS.findIndex(p => p.baseUrl && editConfig.baseUrl.startsWith(p.baseUrl));
      if (idx >= 0) setSelectedPreset(idx);
    }
  }, [editConfig]);

  const handlePresetSelect = (index: number) => {
    setSelectedPreset(index);
    const preset = PRESET_PROVIDERS[index];
    setBaseUrl(preset.baseUrl);
    if (preset.models.length > 0 && !modelId) {
      setModelId(String(preset.models[0]));
    }
    setVerifyResult(null);
  };

  const handleVerify = async () => {
    if (!baseUrl || !apiKey || !modelId) {
      setError('请先填写端点 URL、API Key 和模型 ID');
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    setError(null);
    try {
      const result = await verifyLLMConfig({ baseUrl, apiKey, modelId });
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ success: false, error: err instanceof Error ? err.message : '验证请求失败' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('请输入配置名称'); return; }
    if (!baseUrl.trim()) { setError('请输入端点 URL'); return; }
    if (!isEdit && !apiKey.trim()) { setError('请输入 API Key'); return; }
    if (!modelId.trim()) { setError('请输入模型 ID'); return; }

    // URL format check
    try {
      new URL(baseUrl);
    } catch {
      setError('端点 URL 格式不正确');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editConfig) {
        const payload: Record<string, unknown> = { name, type, baseUrl, modelId, isDefault };
        if (apiKey.trim()) payload.apiKey = apiKey;
        await updateLLMConfig(editConfig.id, payload);
      } else {
        const payload: CreateLLMConfigInput = { name, type, baseUrl, apiKey, modelId, isDefault };
        await createLLMConfig(payload);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = selectedPreset !== null ? PRESET_PROVIDERS[selectedPreset] : null;

  return (
    <div className="ink-card p-6">
      <div className="relative z-10">
        <div className="ink-section-header mb-5">
          <h3 className="ink-section-title">{isEdit ? '编辑配置' : '新建配置'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preset selection */}
          <div>
            <label className="block text-[13px] font-medium mb-2.5" style={{ color: 'var(--ink-wash)' }}>
              快速选择服务商
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROVIDERS.map((preset, idx) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetSelect(idx)}
                  className="ink-chip"
                  style={selectedPreset === idx ? {
                    background: 'var(--ink-black)',
                    color: 'var(--rice-paper)',
                    borderColor: 'var(--ink-black)',
                  } : undefined}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-wash)' }}>
              配置名称 <span style={{ color: 'var(--persimmon)' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="例如：OpenAI GPT-4o"
              className="ink-input"
              maxLength={100}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-wash)' }}>
              配置类型 <span style={{ color: 'var(--persimmon)' }}>*</span>
            </label>
            <div className="ink-tab-bar" style={{ maxWidth: '320px' }}>
              {(['TEXT_LLM', 'IMAGE_GEN'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`ink-tab ${type === t ? 'ink-tab-active' : ''}`}
                >
                  {CONFIG_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px]" style={{ color: 'var(--ink-light)' }}>
              {CONFIG_TYPE_DESCRIPTIONS[type]}
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-wash)' }}>
              端点 URL <span style={{ color: 'var(--persimmon)' }}>*</span>
              {currentPreset?.docsUrl && (
                <a
                  href={currentPreset.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-normal"
                  style={{ color: 'var(--at-info)' }}
                >
                  获取 API Key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={e => { setBaseUrl(e.target.value); setVerifyResult(null); setError(null); }}
              placeholder="https://api.openai.com/v1"
              className="ink-input font-mono text-[13px]"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-wash)' }}>
              API Key {!isEdit && <span style={{ color: 'var(--persimmon)' }}>*</span>}
              {isEdit && <span className="text-[11px] font-normal ml-1" style={{ color: 'var(--ink-light)' }}>(留空则不修改)</span>}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setVerifyResult(null); setError(null); }}
                placeholder={isEdit ? editConfig?.apiKey : (currentPreset?.keyPrefix ? `${currentPreset.keyPrefix}...` : 'your-api-key')}
                className="ink-input font-mono text-[13px] pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2"
                style={{ color: 'var(--ink-light)' }}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Model ID */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ink-wash)' }}>
              模型 ID <span style={{ color: 'var(--persimmon)' }}>*</span>
            </label>
            {currentPreset && currentPreset.models.length > 0 ? (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {currentPreset.models.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setModelId(m); setVerifyResult(null); }}
                      className="ink-chip text-[12px] !py-1 !px-2.5"
                      style={modelId === m ? {
                        background: 'rgba(212, 101, 74, 0.1)',
                        color: 'var(--persimmon)',
                        borderColor: 'rgba(212, 101, 74, 0.3)',
                      } : undefined}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={modelId}
                  onChange={e => { setModelId(e.target.value); setVerifyResult(null); setError(null); }}
                  placeholder="或手动输入模型 ID"
                  className="ink-input font-mono text-[13px]"
                />
              </div>
            ) : (
              <input
                type="text"
                value={modelId}
                onChange={e => { setModelId(e.target.value); setVerifyResult(null); setError(null); }}
                placeholder="gpt-4o"
                className="ink-input font-mono text-[13px]"
              />
            )}
          </div>

          {/* Default toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className="relative w-10 h-[22px] rounded-full transition-colors"
              style={{ background: isDefault ? 'var(--persimmon)' : 'rgba(26, 26, 24, 0.12)' }}
              onClick={() => setIsDefault(!isDefault)}
            >
              <div
                className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: isDefault ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </div>
            <span className="text-[13px]" style={{ color: 'var(--ink-wash)' }}>
              设为此类型的默认配置
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px]"
              style={{ background: 'rgba(220, 38, 38, 0.06)', color: 'var(--at-error)', border: '1px solid rgba(220, 38, 38, 0.12)' }}>
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Verify result */}
          {verifyResult && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px]"
              style={{
                background: verifyResult.success ? 'rgba(22, 163, 74, 0.06)' : 'rgba(220, 38, 38, 0.06)',
                color: verifyResult.success ? 'var(--at-success)' : 'var(--at-error)',
                border: `1px solid ${verifyResult.success ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)'}`,
              }}>
              <VerifyBadge result={verifyResult} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={saving}
              variant="accent"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? '保存修改' : '创建配置'}
            </Button>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || !baseUrl || (!apiKey && !isEdit) || !modelId}
              className="ink-button-ghost inline-flex items-center gap-1.5 text-[13px] disabled:opacity-40"
            >
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              测试连接
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="ink-button-ghost text-[13px]"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export function LLMConfigManager() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editConfig, setEditConfig] = useState<LLMConfig | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listLLMConfigs();
      setConfigs(data);
    } catch (err) {
      console.error('Failed to load LLM configs:', err);
      setMessage({ type: 'error', text: '加载配置列表失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    setShowForm(false);
    setEditConfig(null);
    setMessage({ type: 'success', text: editConfig ? '配置已更新' : '配置已创建' });
    await loadConfigs();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLLMConfig(id);
      setMessage({ type: 'success', text: '配置已删除' });
      await loadConfigs();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '删除失败' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultLLMConfig(id);
      setMessage({ type: 'success', text: '已设为默认配置' });
      await loadConfigs();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '设置默认失败' });
    }
  };

  const handleEdit = (config: LLMConfig) => {
    setEditConfig(config);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditConfig(null);
  };

  // Group by type
  const textConfigs = configs.filter(c => c.type === 'TEXT_LLM');
  const imageConfigs = configs.filter(c => c.type === 'IMAGE_GEN');

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="ink-card p-6">
            <div className="relative z-10 animate-pulse">
              <div className="h-5 rounded w-1/3 mb-4" style={{ background: 'var(--rice-dark)' }} />
              <div className="space-y-2.5">
                <div className="h-4 rounded w-2/3" style={{ background: 'var(--rice-dark)' }} />
                <div className="h-4 rounded w-1/2" style={{ background: 'var(--rice-dark)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast message */}
      {message && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] animate-slide-up"
          style={{
            background: message.type === 'success' ? 'rgba(22, 163, 74, 0.06)' : 'rgba(220, 38, 38, 0.06)',
            color: message.type === 'success' ? 'var(--at-success)' : 'var(--at-error)',
            border: `1px solid ${message.type === 'success' ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)'}`,
          }}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-light)' }}>
            配置 AI 服务商的 API Key、端点和模型，用于文本生成与图片生成
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => { setEditConfig(null); setShowForm(true); }}
            variant="accent"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            新建配置
          </Button>
        )}
      </div>

      {/* Form (create / edit) */}
      {showForm && (
        <ConfigForm
          editConfig={editConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {/* Configs list - Text LLM */}
      {textConfigs.length > 0 && (
        <section>
          <div className="ink-section-header">
            <h3 className="ink-section-title">文本生成</h3>
            <span className="ink-count-badge">{textConfigs.length}</span>
          </div>
          <div className="space-y-3">
            {textConfigs.map(config => (
              <ConfigCard
                key={config.id}
                config={config}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        </section>
      )}

      {/* Configs list - Image Gen */}
      {imageConfigs.length > 0 && (
        <section>
          <div className="ink-section-header">
            <h3 className="ink-section-title">图片生成</h3>
            <span className="ink-count-badge">{imageConfigs.length}</span>
          </div>
          <div className="space-y-3">
            {imageConfigs.map(config => (
              <ConfigCard
                key={config.id}
                config={config}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {configs.length === 0 && !showForm && (
        <div className="ink-empty-state">
          <div className="ink-empty-state-icon">
            <Zap className="w-12 h-12" />
          </div>
          <p className="ink-empty-state-title">还没有 AI 配置</p>
          <p className="ink-empty-state-desc">
            添加你的 API Key 和模型配置，即可开始使用 AI 功能
          </p>
          <Button
            onClick={() => setShowForm(true)}
            variant="accent"
            className="mt-4"
          >
            <Plus className="w-4 h-4" />
            创建第一个配置
          </Button>
        </div>
      )}

      {/* Help text */}
      <div className="px-4 py-3 rounded-xl text-[12px]"
        style={{
          background: 'rgba(37, 99, 235, 0.04)',
          border: '1px solid rgba(37, 99, 235, 0.08)',
          color: 'var(--ink-light)',
        }}>
        <p className="mb-1" style={{ color: 'var(--ink-wash)', fontWeight: 500 }}>
          使用说明
        </p>
        <ul className="space-y-0.5 list-disc list-inside" style={{ color: 'var(--ink-light)' }}>
          <li>支持所有 OpenAI 兼容的 API 服务（OpenAI、DeepSeek、月之暗面等）</li>
          <li>每种类型（文本/图片）的<strong>默认配置</strong>将用于所有 AI 操作</li>
          <li>API Key 使用 AES-256-GCM 加密存储，仅展示掩码</li>
          <li>建议使用「测试连接」按钮验证配置是否可用</li>
        </ul>
      </div>
    </div>
  );
}
