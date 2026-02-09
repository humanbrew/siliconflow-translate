import axios, { AxiosResponse } from 'axios';
import { workspace } from 'vscode';
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';

const PREFIXCONFIG = 'siliconflowTranslate';

// 语言映射：将comment-translate的语言代码映射到硅基流动API支持的语言
const langMaps: Map<string, string> = new Map([
  ['zh-CN', '中文'],
  ['zh-TW', '繁體中文'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['ru', 'Русский'],
  ['pt', 'Português'],
  ['it', 'Italiano'],
  ['ar', 'العربية'],
  ['th', 'ไทย'],
  ['vi', 'Tiếng Việt'],
]);

function convertLang(src: string): string {
  if (langMaps.has(src)) {
    return langMaps.get(src)!;
  }
  // 如果不在映射表中，尝试返回原始值或默认值
  return src;
}

export function getConfig<T>(key: string): T | undefined {
  const configuration = workspace.getConfiguration(PREFIXCONFIG);
  return configuration.get<T>(key);
}

interface SiliconFlowConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  enableThinking?: boolean;
  maxTokens?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  enable_thinking?: boolean;
  stream?: boolean;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class SiliconFlowTranslate implements ITranslate {
  get maxLen(): number {
    // 硅基流动API的token限制较大，这里设置一个合理的字符限制
    return 8000;
  }

  private _defaultOption: SiliconFlowConfig;

  constructor() {
    this._defaultOption = this.createOption();
    workspace.onDidChangeConfiguration(async (eventNames) => {
      if (eventNames.affectsConfiguration(PREFIXCONFIG)) {
        this._defaultOption = this.createOption();
      }
    });
  }

  createOption(): SiliconFlowConfig {
    const defaultOption: SiliconFlowConfig = {
      apiKey: getConfig<string>('apiKey'),
      apiUrl: getConfig<string>('apiUrl') || 'https://api.siliconflow.cn/v1/chat/completions',
      model: getConfig<string>('model') || 'Qwen/Qwen2.5-7B-Instruct',
      temperature: getConfig<number>('temperature') ?? 0.3,
      enableThinking: getConfig<boolean>('enableThinking') ?? false,
      maxTokens: getConfig<number>('maxTokens') ?? 2000,
    };
    return defaultOption;
  }

  /**
   * 构建翻译提示词
   */
  private buildTranslatePrompt(content: string, targetLang: string): string {
    const targetLangName = convertLang(targetLang);
    return `Translate the following text to ${targetLangName}. Only return the translation, no explanations or additional content:

${content}`;
  }

  /**
   * 检测源语言并构建翻译提示词（默认翻译成中文）
   */
  private buildAutoTranslatePrompt(content: string): string {
    return `Translate the following text to Chinese. Only return the translation, no explanations or additional content:

${content}`;
  }

  async translate(content: string, options: ITranslateOptions): Promise<string> {
    const { to = 'auto', from } = options;

    if (!this._defaultOption.apiKey) {
      throw new Error('请配置硅基流动API密钥！请在设置中配置 siliconflowTranslate.apiKey');
    }

    if (!this._defaultOption.model) {
      throw new Error('请配置使用的模型！请在设置中配置 siliconflowTranslate.model');
    }

    const apiUrl = this._defaultOption.apiUrl || 'https://api.siliconflow.cn/v1/chat/completions';

    // 构建消息
    // 如果to为'auto'，默认翻译成中文
    const targetLang = to === 'auto' ? 'zh-CN' : to;
    const userContent = to === 'auto'
      ? this.buildAutoTranslatePrompt(content)
      : this.buildTranslatePrompt(content, targetLang);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a professional translation assistant. Translate the text accurately to the target language, maintaining the original meaning and style.'
      },
      {
        role: 'user',
        content: userContent
      }
    ];

    const requestBody: ChatCompletionRequest = {
      model: this._defaultOption.model,
      messages: messages,
      temperature: this._defaultOption.temperature,
      max_tokens: this._defaultOption.maxTokens,
      stream: false,
    };

    // 如果启用了思考过程且模型支持，则添加该参数
    if (this._defaultOption.enableThinking) {
      requestBody.enable_thinking = true;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._defaultOption.apiKey}`,
      };

      const response: AxiosResponse<ChatCompletionResponse> = await axios.post(
        apiUrl,
        requestBody,
        { headers }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const translatedText = response.data.choices[0].message.content.trim();

        // 如果返回的内容包含原始提示词，尝试提取纯翻译结果
        // 有些模型可能会返回包含提示的内容
        if (translatedText.includes(content)) {
          // 尝试提取翻译后的部分
          const lines = translatedText.split('\n');
          const filteredLines = lines.filter(line =>
            !line.includes('翻译') &&
            !line.includes('translate') &&
            line.trim().length > 0 &&
            !line.includes(content)
          );
          if (filteredLines.length > 0) {
            return filteredLines.join('\n').trim();
          }
        }

        return translatedText;
      } else {
        throw new Error('翻译响应格式错误');
      }
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          throw new Error('API密钥无效，请检查配置的 siliconflowTranslate.apiKey');
        } else if (status === 403) {
          throw new Error('API访问被拒绝，请检查API密钥权限');
        } else if (status === 429) {
          throw new Error('请求频率过高，请稍后再试');
        } else if (status === 400) {
          const errorMsg = typeof data === 'string' ? data : (data?.message || '请求参数错误');
          throw new Error(`请求错误: ${errorMsg}`);
        } else {
          throw new Error(`API请求失败: ${status} - ${data?.message || error.message}`);
        }
      } else if (error.request) {
        throw new Error('网络请求失败，请检查网络连接和API地址配置');
      } else {
        throw new Error(`翻译失败: ${error.message}`);
      }
    }
  }

  link(content: string, options: ITranslateOptions): string {
    // 硅基流动没有公开的在线翻译页面，返回一个简单的链接文本
    return `[SiliconFlow](${this._defaultOption.apiUrl || 'https://api.siliconflow.cn'})`;
  }

  isSupported(src: string): boolean {
    // 支持所有语言
    return true;
  }
}
