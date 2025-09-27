import React, { useEffect, useState } from "react";
import { Provider } from "../types";
import { Play, Edit3, Trash2, CheckCircle2, Users, LogIn, RefreshCw } from "lucide-react";
import { buttonStyles, cardStyles, badgeStyles, cn } from "../lib/styles";
import { AppType } from "../lib/tauri-api";
import {
  applyProviderToVSCode,
  detectApplied,
  normalizeBaseUrl,
} from "../utils/vscodeSettings";
import { getCodexBaseUrl } from "../utils/providerConfigUtils";
import { useVSCodeAutoSync } from "../hooks/useVSCodeAutoSync";
import FizzlyCodeAuth from "./FizzlyCodeAuth";
// 不再在列表中显示分类徽章，避免造成困惑

interface ProviderListProps {
  providers: Record<string, Provider>;
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSave?: (provider: Provider) => void;  // Add onSave prop
  appType?: AppType;
  onNotify?: (
    message: string,
    type: "success" | "error",
    duration?: number
  ) => void;
}

const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  currentProviderId,
  onSwitch,
  onDelete,
  onEdit,
  onSave,
  appType,
  onNotify,
}) => {
  // 提取API地址（兼容不同供应商配置：Claude env / Codex TOML）
  const getApiUrl = (provider: Provider): string => {
    try {
      const cfg = provider.settingsConfig;
      // Claude/Anthropic: 从 env 中读取
      if (cfg?.env?.ANTHROPIC_BASE_URL) {
        return cfg.env.ANTHROPIC_BASE_URL;
      }
      // Codex: 从 TOML 配置中解析 base_url
      if (typeof cfg?.config === "string" && cfg.config.includes("base_url")) {
        // 支持单/双引号
        const match = cfg.config.match(/base_url\s*=\s*(['"])([^'\"]+)\1/);
        if (match && match[2]) return match[2];
      }
      return "未配置官网地址";
    } catch {
      return "配置错误";
    }
  };

  const handleUrlClick = async (url: string) => {
    try {
      await window.api.openExternal(url);
    } catch (error) {
      console.error("打开链接失败:", error);
    }
  };

  // 解析 Codex 配置中的 base_url（已提取到公共工具）

  // VS Code 按钮：仅在 Codex + 当前供应商显示；按钮文案根据是否"已应用"变化
  const [vscodeAppliedFor, setVscodeAppliedFor] = useState<string | null>(null);
  const { enableAutoSync, disableAutoSync } = useVSCodeAutoSync();

  // 当当前供应商或 appType 变化时，尝试读取 VS Code settings 并检测状态
  useEffect(() => {
    const check = async () => {
      if (appType !== "codex" || !currentProviderId) {
        setVscodeAppliedFor(null);
        return;
      }
      const status = await window.api.getVSCodeSettingsStatus();
      if (!status.exists) {
        setVscodeAppliedFor(null);
        return;
      }
      try {
        const content = await window.api.readVSCodeSettings();
        const detected = detectApplied(content);
        // 认为“已应用”的条件（非官方供应商）：VS Code 中的 apiBase 与当前供应商的 base_url 完全一致
        const current = providers[currentProviderId];
        let applied = false;
        if (current && current.category !== "official") {
          const base = getCodexBaseUrl(current);
          if (detected.apiBase && base) {
            applied =
              normalizeBaseUrl(detected.apiBase) === normalizeBaseUrl(base);
          }
        }
        setVscodeAppliedFor(applied ? currentProviderId : null);
      } catch {
        setVscodeAppliedFor(null);
      }
    };
    check();
  }, [appType, currentProviderId, providers]);

  const handleApplyToVSCode = async (provider: Provider) => {
    try {
      const status = await window.api.getVSCodeSettingsStatus();
      if (!status.exists) {
        onNotify?.(
          "未找到 VS Code 用户设置文件 (settings.json)",
          "error",
          3000
        );
        return;
      }

      const raw = await window.api.readVSCodeSettings();

      const isOfficial = provider.category === "official";
      // 非官方且缺少 base_url 时直接报错并返回，避免“空写入”假成功
      if (!isOfficial) {
        const parsed = getCodexBaseUrl(provider);
        if (!parsed) {
          onNotify?.("当前配置缺少 base_url，无法写入 VS Code", "error", 4000);
          return;
        }
      }

      const baseUrl = isOfficial ? undefined : getCodexBaseUrl(provider);
      const next = applyProviderToVSCode(raw, { baseUrl, isOfficial });

      if (next === raw) {
        // 幂等：没有变化也提示成功
        onNotify?.("已应用到 VS Code，重启 Codex 插件以生效", "success", 3000);
        setVscodeAppliedFor(provider.id);
        // 用户手动应用时，启用自动同步
        enableAutoSync();
        return;
      }

      await window.api.writeVSCodeSettings(next);
      onNotify?.("已应用到 VS Code，重启 Codex 插件以生效", "success", 3000);
      setVscodeAppliedFor(provider.id);
      // 用户手动应用时，启用自动同步
      enableAutoSync();
    } catch (e: any) {
      console.error(e);
      const msg = e && e.message ? e.message : "应用到 VS Code 失败";
      onNotify?.(msg, "error", 5000);
    }
  };

  const handleRemoveFromVSCode = async () => {
    try {
      const status = await window.api.getVSCodeSettingsStatus();
      if (!status.exists) {
        onNotify?.(
          "未找到 VS Code 用户设置文件 (settings.json)",
          "error",
          3000
        );
        return;
      }
      const raw = await window.api.readVSCodeSettings();
      const next = applyProviderToVSCode(raw, {
        baseUrl: undefined,
        isOfficial: true,
      });
      if (next === raw) {
        onNotify?.("已从 VS Code 移除，重启 Codex 插件以生效", "success", 3000);
        setVscodeAppliedFor(null);
        // 用户手动移除时，禁用自动同步
        disableAutoSync();
        return;
      }
      await window.api.writeVSCodeSettings(next);
      onNotify?.("已从 VS Code 移除，重启 Codex 插件以生效", "success", 3000);
      setVscodeAppliedFor(null);
      // 用户手动移除时，禁用自动同步
      disableAutoSync();
    } catch (e: any) {
      console.error(e);
      const msg = e && e.message ? e.message : "移除失败";
      onNotify?.(msg, "error", 5000);
    }
  };

  // State for FizzlyCode authentication
  const [showFizzlyAuth, setShowFizzlyAuth] = useState<string | null>(null);
  const [localTestMode, setLocalTestMode] = useState(() => {
    // Check if we're in development mode or if user has enabled local test mode
    const isDev = import.meta.env.DEV;
    const userPref = localStorage.getItem('fizzlycode_local_test');
    return isDev || userPref === 'true';
  });

  // Handle FizzlyCode API key received
  const handleFizzlyCodeApiKey = async (providerId: string, apiKey: string) => {
    const provider = providers[providerId];
    if (!provider) return;

    // Update the provider's API key
    const updatedProvider = { ...provider };
    if (appType === "claude") {
      if (!updatedProvider.settingsConfig.env) {
        updatedProvider.settingsConfig.env = {};
      }
      updatedProvider.settingsConfig.env.ANTHROPIC_AUTH_TOKEN = apiKey;
    } else if (appType === "codex") {
      if (!updatedProvider.settingsConfig.auth) {
        updatedProvider.settingsConfig.auth = {};
      }
      updatedProvider.settingsConfig.auth.OPENAI_API_KEY = apiKey;
    }

    // Save the updated provider
    if (onSave) {
      onSave(updatedProvider);
    } else {
      // Fallback to onEdit if onSave is not provided
      onEdit(providerId);
    }

    // Show success notification
    onNotify?.("API Key 已自动设置成功", "success", 2000);
  };

  // 对供应商列表进行排序
  const sortedProviders = Object.values(providers).sort((a, b) => {
    // 按添加时间排序
    // 没有时间戳的视为最早添加的（排在最前面）
    // 有时间戳的按时间升序排列
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;

    // 如果都没有时间戳，按名称排序
    if (timeA === 0 && timeB === 0) {
      return a.name.localeCompare(b.name, "zh-CN");
    }

    // 如果只有一个没有时间戳，没有时间戳的排在前面
    if (timeA === 0) return -1;
    if (timeB === 0) return 1;

    // 都有时间戳，按时间升序
    return timeA - timeB;
  });

  return (
    <div className="space-y-4">
      {sortedProviders.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Users size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            还没有添加任何供应商
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            点击右上角的"添加供应商"按钮开始配置您的第一个API供应商
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedProviders.map((provider) => {
            const isCurrent = provider.id === currentProviderId;
            const apiUrl = getApiUrl(provider);

            return (
              <div
                key={provider.id}
                className={cn(
                  isCurrent ? cardStyles.selected : cardStyles.interactive
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {provider.name}
                      </h3>
                      {/* 分类徽章已移除 */}
                      <div
                        className={cn(
                          badgeStyles.success,
                          !isCurrent && "invisible"
                        )}
                      >
                        <CheckCircle2 size={12} />
                        当前使用
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {provider.websiteUrl ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleUrlClick(provider.websiteUrl!);
                          }}
                          className="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 hover:opacity-90 transition-colors"
                          title={`访问 ${provider.websiteUrl}`}
                        >
                          {provider.websiteUrl}
                        </button>
                      ) : (
                        <span
                          className="text-gray-500 dark:text-gray-400"
                          title={apiUrl}
                        >
                          {apiUrl}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {/* FizzlyCode login/status button */}
                    {provider.name.toLowerCase().includes("fizzlycode") && (
                      <>
                        {(() => {
                          // Check if API key is configured
                          const hasApiKey = appType === "claude"
                            ? provider.settingsConfig?.env?.ANTHROPIC_AUTH_TOKEN
                            : provider.settingsConfig?.auth?.OPENAI_API_KEY;

                          // Check if user has saved FizzlyCode authentication
                          const hasSavedAuth = localStorage.getItem('fizzlycode_token');

                          if (hasApiKey) {
                            // API Key is configured - show status
                            return (
                              <div className="inline-flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <CheckCircle2 size={14} />
                                  已配置
                                </span>
                                <button
                                  onClick={() => setShowFizzlyAuth(provider.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border border-gray-300 text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-purple-700 dark:hover:text-purple-400 dark:hover:bg-purple-900/20"
                                  title="重新配置 FizzlyCode 账户"
                                >
                                  <RefreshCw size={14} />
                                  重新配置
                                </button>
                              </div>
                            );
                          } else if (hasSavedAuth) {
                            // User has logged in before but no API key - might need to sync
                            return (
                              <button
                                onClick={() => setShowFizzlyAuth(provider.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
                                title="同步 FizzlyCode API Key"
                              >
                                <RefreshCw size={14} />
                                同步 API Key
                              </button>
                            );
                          } else {
                            // Not logged in and no API key
                            return (
                              <button
                                onClick={() => setShowFizzlyAuth(provider.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
                                title="登录 FizzlyCode 账户获取 API Key"
                              >
                                <LogIn size={14} />
                                登录获取 Key
                              </button>
                            );
                          }
                        })()}
                        {import.meta.env.DEV && (
                          <button
                            onClick={async () => {
                              const newMode = !localTestMode;
                              setLocalTestMode(newMode);
                              localStorage.setItem('fizzlycode_local_test', newMode.toString());

                              // 更新FizzlyCode供应商的API端点和网站URL
                              const updatedProvider = { ...provider };
                              const baseUrl = newMode ? 'http://localhost:3000' : 'https://fizzlycode.com';
                              const apiUrl = newMode ? 'http://localhost:3000/api' : 'https://fizzlycode.com/api';

                              // 更新网站URL
                              updatedProvider.websiteUrl = baseUrl;

                              // 更新API端点
                              if (appType === "claude") {
                                if (!updatedProvider.settingsConfig) {
                                  updatedProvider.settingsConfig = { env: {} };
                                }
                                if (!updatedProvider.settingsConfig.env) {
                                  updatedProvider.settingsConfig.env = {};
                                }
                                updatedProvider.settingsConfig.env.ANTHROPIC_BASE_URL = apiUrl;
                              } else if (appType === "codex") {
                                // 为Codex更新config.toml内容
                                const codexApiUrl = newMode ? 'http://localhost:3000/openai' : 'https://fizzlycode.com/openai';
                                const configContent = `model_provider = "fizzlycode"
model = "gpt-5"  # Can be changed to "gpt-5-codex" for enhanced reasoning
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.fizzlycode]
name = "fizzlycode"
base_url = "${codexApiUrl}"
wire_api = "responses"
requires_openai_auth = true  # IMPORTANT: Add this for model switching support`;

                                if (!updatedProvider.settingsConfig) {
                                  updatedProvider.settingsConfig = { config: configContent };
                                } else {
                                  updatedProvider.settingsConfig.config = configContent;
                                }
                              }

                              // 保存更新后的供应商配置
                              if (onSave) {
                                await onSave(updatedProvider);
                              }

                              onNotify?.(
                                `切换到${newMode ? '本地测试' : '生产'}环境`,
                                "success",
                                2000
                              );
                            }}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                            title={localTestMode ? '切换到生产环境' : '切换到本地测试环境'}
                          >
                            {localTestMode ? 'Local' : 'Prod'}
                          </button>
                        )}
                      </>
                    )}

                    {appType === "codex" &&
                      provider.category !== "official" && (
                        <button
                          onClick={() =>
                            vscodeAppliedFor === provider.id
                              ? handleRemoveFromVSCode()
                              : handleApplyToVSCode(provider)
                          }
                          className={cn(
                            "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors w-[130px] whitespace-nowrap justify-center",
                            !isCurrent && "invisible",
                            vscodeAppliedFor === provider.id
                              ? "border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-red-800 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                              : "border border-gray-300 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
                          )}
                          title={
                            vscodeAppliedFor === provider.id
                              ? "从 VS Code 移除我们写入的配置"
                              : "将当前供应商应用到 VS Code"
                          }
                        >
                          {vscodeAppliedFor === provider.id
                            ? "从 VS Code 移除"
                            : "应用到 VS Code"}
                        </button>
                      )}
                    <button
                      onClick={() => onSwitch(provider.id)}
                      disabled={isCurrent}
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors w-[76px] justify-center whitespace-nowrap",
                        isCurrent
                          ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                      )}
                    >
                      {!isCurrent && <Play size={14} />}
                      {isCurrent ? "使用中" : "启用"}
                    </button>

                    <button
                      onClick={() => onEdit(provider.id)}
                      className={buttonStyles.icon}
                      title="编辑供应商"
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      onClick={() => onDelete(provider.id)}
                      disabled={isCurrent}
                      className={cn(
                        buttonStyles.icon,
                        isCurrent
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-500 hover:text-red-500 hover:bg-red-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                      )}
                      title="删除供应商"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FizzlyCode Authentication Modal */}
      {showFizzlyAuth && (
        <FizzlyCodeAuth
          provider={providers[showFizzlyAuth]}
          appType={appType || "claude"}
          onApiKeyReceived={(apiKey) => {
            handleFizzlyCodeApiKey(showFizzlyAuth, apiKey);
            setShowFizzlyAuth(null);
          }}
          onClose={() => setShowFizzlyAuth(null)}
          useLocalhost={localTestMode}
          onProviderUpdate={(updatedProvider) => {
            // Save the updated provider configuration when environment switches
            if (onSave) {
              onSave(updatedProvider);
            }
          }}
        />
      )}
    </div>
  );
};

export default ProviderList;
