import axios, { AxiosResponse } from 'axios';
import { workspace, window } from 'vscode';
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { outputChannel } from './extension';

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
    const apiKey = getConfig<string>('apiKey');
    const defaultOption: SiliconFlowConfig = {
      apiKey: apiKey,
      apiUrl: getConfig<string>('apiUrl') || 'https://api.siliconflow.cn/v1/chat/completions',
      model: getConfig<string>('model') || 'Qwen/Qwen2.5-7B-Instruct',
      temperature: getConfig<number>('temperature') ?? 0.3,
      enableThinking: getConfig<boolean>('enableThinking') ?? false,
      maxTokens: getConfig<number>('maxTokens') ?? 2000,
    };

    // 输出配置信息到日志
    outputChannel.appendLine(`[SiliconFlow Translate] Configuration loaded:`);
    outputChannel.appendLine(`  - API Key: ${apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET'}`);
    outputChannel.appendLine(`  - Model: ${defaultOption.model}`);
    outputChannel.appendLine(`  - API URL: ${defaultOption.apiUrl}`);
    outputChannel.appendLine(`  - Temperature: ${defaultOption.temperature}`);

    return defaultOption;
  }

  /**
   * 检测是否是代码注释格式（JSDoc、单行注释、多行注释等）
   */
  private isCommentFormat(text: string): boolean {
    // 检测JSDoc格式 /** ... */
    if (text.trim().startsWith('/**') || text.includes('*/')) {
      return true;
    }
    // 检测单行注释 //
    if (text.split('\n').some(line => line.trim().startsWith('//'))) {
      return true;
    }
    // 检测多行注释 /* ... */
    if (text.includes('/*') && text.includes('*/')) {
      return true;
    }
    // 检测Python风格的注释 #
    if (text.split('\n').some(line => line.trim().startsWith('#'))) {
      return true;
    }
    return false;
  }

  /**
   * 构建翻译提示词 - 针对代码注释格式优化
   */
  private buildTranslatePrompt(content: string, targetLang: string): string {
    const targetLangName = convertLang(targetLang);
    const isComment = this.isCommentFormat(content);

    if (isComment) {
      return `Translate the following code comment to ${targetLangName}. IMPORTANT RULES:
1. Preserve ALL comment structure exactly (/** */, //, /* */, #, etc.)
2. Preserve ALL JSDoc tags (@param, @returns, @private, etc.) - DO NOT translate them
3. Preserve parameter names, variable names, and code identifiers - DO NOT translate them
4. Preserve line prefixes like "* " in JSDoc comments
5. Only translate descriptive text, not code elements
6. Maintain the exact same line structure and indentation
7. Return ONLY the translated comment, no explanations

Original comment:
${content}`;
    } else {
      return `Translate the following text to ${targetLangName}. Preserve any code formatting, structure, and special characters. Only return the translation, no explanations:

${content}`;
    }
  }

  /**
   * 检测源语言并构建翻译提示词（默认翻译成中文）
   */
  private buildAutoTranslatePrompt(content: string): string {
    const isComment = this.isCommentFormat(content);

    if (isComment) {
      return `Translate the following code comment to Chinese. IMPORTANT RULES:
1. Preserve ALL comment structure exactly (/** */, //, /* */, #, etc.)
2. Preserve ALL JSDoc tags (@param, @returns, @private, etc.) - DO NOT translate them
3. Preserve parameter names, variable names, and code identifiers - DO NOT translate them
4. Preserve line prefixes like "* " in JSDoc comments
5. Only translate descriptive text, not code elements
6. Maintain the exact same line structure and indentation
7. Return ONLY the translated comment, no explanations

Original comment:
${content}`;
    } else {
      return `Translate the following text to Chinese. Preserve any code formatting, structure, and special characters. Only return the translation, no explanations:

${content}`;
    }
  }

  async translate(content: string, options: ITranslateOptions): Promise<string> {
    const { to = 'auto', from } = options;
    outputChannel.appendLine(`hello world`);

    // 输出翻译请求日志
    outputChannel.appendLine(`[SiliconFlow Translate] Translation request received`);
    outputChannel.appendLine(`  - Content length: ${content.length} characters`);
    outputChannel.appendLine(`  - Target language: ${to}`);
    outputChannel.appendLine(`  - Source language: ${from || 'auto'}`);
    outputChannel.appendLine(`  - Content preview: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);

    // 重新读取配置，确保获取最新值
    const currentApiKey = getConfig<string>('apiKey');
    const currentModel = getConfig<string>('model') || 'Qwen/Qwen2.5-7B-Instruct';

    outputChannel.appendLine(`[SiliconFlow Translate] Current configuration:`);
    outputChannel.appendLine(`  - API Key: ${currentApiKey ? `${currentApiKey.substring(0, 8)}...` : 'NOT SET'}`);
    outputChannel.appendLine(`  - Model: ${currentModel}`);

    // 使用最新读取的配置值进行验证
    if (!currentApiKey || currentApiKey.trim() === '') {
      const errorMsg = '请配置硅基流动API密钥！请在设置中配置 siliconflowTranslate.apiKey';
      outputChannel.appendLine(`[SiliconFlow Translate] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 更新内部配置（如果配置已更改）
    if (currentApiKey !== this._defaultOption.apiKey || currentModel !== this._defaultOption.model) {
      outputChannel.appendLine(`[SiliconFlow Translate] Configuration changed, updating...`);
      this._defaultOption = this.createOption();
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

    const isComment = this.isCommentFormat(content);
    const systemPrompt = isComment
      ? 'You are a professional code comment translator. You specialize in translating code comments while preserving all structural elements, JSDoc tags, code identifiers, and formatting. You only translate descriptive text, never code elements or tags.'
      : 'You are a professional translation assistant. Translate the text accurately to the target language, maintaining the original meaning, style, and formatting.';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt
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

      outputChannel.appendLine(`[SiliconFlow Translate] Sending API request:`);
      outputChannel.appendLine(`  - URL: ${apiUrl}`);
      outputChannel.appendLine(`  - Model: ${requestBody.model}`);
      outputChannel.appendLine(`  - Messages count: ${messages.length}`);

      const response: AxiosResponse<ChatCompletionResponse> = await axios.post(
        apiUrl,
        requestBody,
        { headers }
      );

      outputChannel.appendLine(`[SiliconFlow Translate] API response received:`);
      outputChannel.appendLine(`  - Status: ${response.status}`);
      if (response.data.usage) {
        outputChannel.appendLine(`  - Tokens used: ${response.data.usage.total_tokens} (prompt: ${response.data.usage.prompt_tokens}, completion: ${response.data.usage.completion_tokens})`);
      }

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const translatedText = response.data.choices[0].message.content.trim();

        outputChannel.appendLine(`[SiliconFlow Translate] Response.data: ${JSON.stringify(response.data)}`);

        outputChannel.appendLine(`[SiliconFlow Translate] Translation completed:`);
        outputChannel.appendLine(`  - Translated length: ${translatedText.length} characters`);
        // outputChannel.appendLine(`  - Preview: ${translatedText.substring(0, 100)}${translatedText.length > 100 ? '...' : ''}`);
        outputChannel.appendLine(`  - Preview ALL: ${translatedText}`);

        // 如果返回的内容包含原始提示词，尝试提取纯翻译结果
        // 有些模型可能会返回包含提示的内容
        if (translatedText.includes(content)) {
          outputChannel.appendLine(`[SiliconFlow Translate] Detected original content in response, filtering...`);
          // 尝试提取翻译后的部分
          const lines = translatedText.split('\n');
          const filteredLines = lines.filter(line =>
            !line.includes('翻译') &&
            !line.includes('translate') &&
            line.trim().length > 0 &&
            !line.includes(content)
          );
          if (filteredLines.length > 0) {
            const filteredText = filteredLines.join('\n').trim();
            outputChannel.appendLine(`[SiliconFlow Translate] Filtered translation returned`);
            return filteredText;
          }
        }

        return translatedText;
      } else {
        const errorMsg = '翻译响应格式错误';
        outputChannel.appendLine(`[SiliconFlow Translate] ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      outputChannel.appendLine(`[SiliconFlow Translate] ERROR occurred:`);
      outputChannel.appendLine(`  - Error message: ${error.message}`);

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        outputChannel.appendLine(`  - HTTP Status: ${status}`);
        outputChannel.appendLine(`  - Response data: ${JSON.stringify(data)}`);

        let errorMsg: string;
        if (status === 401) {
          errorMsg = 'API密钥无效，请检查配置的 siliconflowTranslate.apiKey';
        } else if (status === 403) {
          errorMsg = 'API访问被拒绝，请检查API密钥权限';
        } else if (status === 429) {
          errorMsg = '请求频率过高，请稍后再试';
        } else if (status === 400) {
          errorMsg = typeof data === 'string' ? data : (data?.message || '请求参数错误');
          errorMsg = `请求错误: ${errorMsg}`;
        } else {
          errorMsg = `API请求失败: ${status} - ${data?.message || error.message}`;
        }

        outputChannel.appendLine(`  - Throwing error: ${errorMsg}`);
        throw new Error(errorMsg);
      } else if (error.request) {
        const errorMsg = '网络请求失败，请检查网络连接和API地址配置';
        outputChannel.appendLine(`  - Network error: ${errorMsg}`);
        throw new Error(errorMsg);
      } else {
        const errorMsg = `翻译失败: ${error.message}`;
        outputChannel.appendLine(`  - General error: ${errorMsg}`);
        throw new Error(errorMsg);
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
