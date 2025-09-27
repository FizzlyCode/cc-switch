/**
 * 预设供应商配置模板
 */
import { ProviderCategory } from "../types";

export interface ProviderPreset {
  name: string;
  websiteUrl: string;
  // 新增：第三方/聚合等可单独配置获取 API Key 的链接
  apiKeyUrl?: string;
  settingsConfig: object;
  isOfficial?: boolean; // 标识是否为官方预设
  category?: ProviderCategory; // 新增：分类
}

export const providerPresets: ProviderPreset[] = [
  {
    name: "Claude官方",
    websiteUrl: "https://www.anthropic.com/claude-code",
    settingsConfig: {
      env: {},
    },
    isOfficial: true, // 明确标识为官方预设
    category: "official",
  },
  {
    name: "FizzlyCode",
    websiteUrl: "https://fizzlycode.com",
    apiKeyUrl: "https://fizzlycode.com/dashboard",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://fizzlycode.com/api",
        ANTHROPIC_AUTH_TOKEN: "",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
      },
    },
    category: "third_party",
  },
  {
    name: "DeepSeek",
    websiteUrl: "https://platform.deepseek.com",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "DeepSeek-V3.1-Terminus",
        ANTHROPIC_SMALL_FAST_MODEL: "DeepSeek-V3.1-Terminus",
      },
    },
    category: "cn_official",
  },
  {
    name: "智谱GLM",
    websiteUrl: "https://open.bigmodel.cn",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "GLM-4.5",
        ANTHROPIC_SMALL_FAST_MODEL: "GLM-4.5-Air",
      },
    },
    category: "cn_official",
  },
  {
    name: "Qwen-Coder",
    websiteUrl: "https://bailian.console.aliyun.com",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL:
          "https://dashscope.aliyuncs.com/api/v2/apps/claude-code-proxy",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "qwen3-max",
        ANTHROPIC_SMALL_FAST_MODEL: "qwen3-max",
      },
    },
    category: "cn_official",
  },
  {
    name: "Kimi k2",
    websiteUrl: "https://platform.moonshot.cn/console",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://api.moonshot.cn/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "kimi-k2-turbo-preview",
        ANTHROPIC_SMALL_FAST_MODEL: "kimi-k2-turbo-preview",
      },
    },
    category: "cn_official",
  },
  {
    name: "魔搭",
    websiteUrl: "https://modelscope.cn",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://api-inference.modelscope.cn",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "ZhipuAI/GLM-4.5",
        ANTHROPIC_SMALL_FAST_MODEL: "ZhipuAI/GLM-4.5",
      },
    },
    category: "aggregator",
  },
  {
    name: "PackyCode",
    websiteUrl: "https://www.packycode.com",
    apiKeyUrl: "https://www.packycode.com/?aff=rlo54mgz",
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: "https://api.packycode.com",
        ANTHROPIC_AUTH_TOKEN: "",
      },
    },
    category: "third_party",
  },
];
