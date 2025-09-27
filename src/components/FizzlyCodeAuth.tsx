import React, { useState, useEffect } from "react";
import { FizzlyCodeAuthService } from "../services/fizzlyCodeAuth";
import { Loader2, ExternalLink, Key, Copy, CheckCircle, XCircle } from "lucide-react";

interface FizzlyCodeAuthProps {
  provider: any;
  appType: "claude" | "codex";
  onApiKeyReceived: (apiKey: string) => void;
  onClose: () => void;
  useLocalhost?: boolean; // For testing with local FizzlyCode instance
  onProviderUpdate?: (provider: any) => void; // Callback to update provider config
}

const FizzlyCodeAuth: React.FC<FizzlyCodeAuthProps> = ({
  provider,
  appType,
  onApiKeyReceived,
  onClose,
  useLocalhost = false,
  onProviderUpdate
}) => {
  const authService = FizzlyCodeAuthService.getInstance();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [existingApiKey, setExistingApiKey] = useState<string | null>(null);

  // Update authService config when environment changes
  useEffect(() => {
    authService.updateConfig({
      baseUrl: useLocalhost ? 'http://localhost:3000' : 'https://fizzlycode.com'
    });
  }, [useLocalhost]);

  useEffect(() => {
    // Check for existing authentication
    const checkExistingAuth = async () => {
      if (authService.isAuthenticated()) {
        const apiKey = authService.getStoredApiKey();
        if (apiKey) {
          setExistingApiKey(apiKey);
        }
      }
    };
    checkExistingAuth();

    // Cleanup on unmount
    return () => {
      authService.stopPolling();
    };
  }, []);

  // Sync API endpoint and website URL when environment changes
  useEffect(() => {
    if (onProviderUpdate && provider) {
      const updatedProvider = { ...provider };
      const baseUrl = useLocalhost ? 'http://localhost:3000' : 'https://fizzlycode.com';
      const apiUrl = useLocalhost ? 'http://localhost:3000/api' : 'https://fizzlycode.com/api';

      // Update website URL
      updatedProvider.websiteUrl = baseUrl;

      // Update API endpoint based on app type
      if (appType === "claude") {
        if (!updatedProvider.settingsConfig) {
          updatedProvider.settingsConfig = { env: {} };
        }
        if (!updatedProvider.settingsConfig.env) {
          updatedProvider.settingsConfig.env = {};
        }
        updatedProvider.settingsConfig.env.ANTHROPIC_BASE_URL = apiUrl;
      } else if (appType === "codex") {
        // For Codex, config is a TOML string, not an object
        // The base URL update for Codex is handled in ProviderList.tsx
        // We don't need to modify the config here
      }

      // Call the update callback
      onProviderUpdate(updatedProvider);
    }
  }, [useLocalhost, provider, appType, onProviderUpdate]);

  const handleCopyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setStatus('idle');
    setErrorMessage(null);
    setDeviceCode(null);
    setVerificationUrl(null);

    await authService.authenticate(
      (apiKey) => {
        // Success
        setStatus('success');
        setIsAuthenticating(false);
        onApiKeyReceived(apiKey);

        // Close after a brief delay to show success
        setTimeout(() => {
          onClose();
        }, 1500);
      },
      (error) => {
        // Error
        setStatus('error');
        setErrorMessage(error);
        setIsAuthenticating(false);
      },
      (code, url) => {
        // Code received
        setDeviceCode(code);
        setVerificationUrl(url);
        setStatus('waiting');
      }
    );
  };

  const handleUseExistingKey = () => {
    if (existingApiKey) {
      onApiKeyReceived(existingApiKey);
      onClose();
    }
  };

  const handleLogout = () => {
    authService.clearAuth();
    setExistingApiKey(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          FizzlyCode 账户登录
        </h2>

        {/* Existing authentication */}
        {existingApiKey && !isAuthenticating && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-green-800 dark:text-green-200 font-medium">
                已登录
              </span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              检测到已保存的登录信息，可以直接使用
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleUseExistingKey}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                使用已有凭证
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                重新登录
              </button>
            </div>
          </div>
        )}

        {/* Device code display */}
        {deviceCode && status === 'waiting' && (
          <div className="mb-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                请在浏览器中输入以下验证码：
              </p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 border-2 border-blue-400 dark:border-blue-600 rounded text-center">
                  <span className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                    {deviceCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="复制验证码"
                >
                  {copiedCode ? <CheckCircle size={20} /> : <Copy size={20} />}
                </button>
              </div>
              {verificationUrl && (
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  如果浏览器未自动打开，请点击这里
                  <ExternalLink size={14} />
                </a>
              )}
              <div className="mt-3 flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  等待授权中...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {status === 'success' && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-green-800 dark:text-green-200">
                登录成功！正在设置 API Key...
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-800 dark:text-red-200">
                {errorMessage}
              </span>
            </div>
          </div>
        )}

        {/* Info section */}
        {status === 'idle' && !existingApiKey && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              点击下方按钮登录您的 FizzlyCode 账户，系统将自动获取并配置 API Key。
            </p>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <div className="flex items-start">
                <Key className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 mr-2" />
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p>登录后将自动：</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>获取专用 API Key</li>
                    <li>配置到当前供应商</li>
                    <li>保存登录状态</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isAuthenticating && status !== 'success' && !existingApiKey && (
            <button
              onClick={handleAuthenticate}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              登录 FizzlyCode
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isAuthenticating && status === 'waiting'}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'success' ? '完成' : '取消'}
          </button>
        </div>

        {/* Local test mode indicator */}
        {useLocalhost && (
          <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 text-center">
            本地测试模式 (localhost:3000)
          </div>
        )}
      </div>
    </div>
  );
};

export default FizzlyCodeAuth;