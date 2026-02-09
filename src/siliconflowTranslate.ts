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
   * 检测是否包含JSDoc标签（用于优化提示词）
   * 注意：content参数不包含注释标记，只包含纯文本
   */
  private hasJSDocTags(text: string): boolean {
    // 检测JSDoc标签，即使没有注释标记
    const jsdocTags = ['@param', '@returns', '@throws', '@private', '@public', '@deprecated', '@example', '@see', '@since', '@author', '@version'];
    return jsdocTags.some(tag => text.includes(tag));
  }

  /**
   * 构建翻译提示词
   * 注意：content参数是纯文本（不包含注释标记），Comment Translate会在显示时重新应用格式
   * 参考 Google Translate 的实现：简单直接，返回纯文本翻译
   */
  private buildTranslatePrompt(content: string, targetLang: string): string {
    const targetLangName = convertLang(targetLang);
    const hasTags = this.hasJSDocTags(content);
    const lines = content.split('\n');
    const lineCount = lines.length;

    // 构建逐行翻译的提示
    const lineByLinePrompt = lines.map((line, index) => `Line ${index + 1}: ${line}`).join('\n');

    if (hasTags) {
      return `Translate the following text to ${targetLangName}. 

CRITICAL RULES:
1. Translate line by line. Keep EXACTLY ${lineCount} lines.
2. For each line:
   - If line starts with "@param", "@returns", "@throws", etc.: Keep the tag and parameter name, only translate the description after "-"
   - If line contains code identifiers (variable names, function names): Keep them unchanged
   - Otherwise: Translate the entire line
3. DO NOT use bullet points (-), numbered lists, or any formatting markers
4. DO NOT add explanations or additional content
5. Return ONLY the translated text, one line per line

Input (${lineCount} lines):
${lineByLinePrompt}

Output (${lineCount} lines, translate each line):`;
    } else {
      return `Translate the following text to ${targetLangName}. 
Keep EXACTLY ${lineCount} lines. Translate line by line. DO NOT use bullet points or numbered lists.
Return ONLY the translation:

${content}`;
    }
  }

  /**
   * 检测源语言并构建翻译提示词（默认翻译成中文）
   */
  private buildAutoTranslatePrompt(content: string): string {
    const hasTags = this.hasJSDocTags(content);
    const lines = content.split('\n');
    const lineCount = lines.length;

    // 构建逐行翻译的提示
    const lineByLinePrompt = lines.map((line, index) => `Line ${index + 1}: ${line}`).join('\n');

    if (hasTags) {
      return `Translate the following text to Chinese.

CRITICAL RULES:
1. Translate line by line. Keep EXACTLY ${lineCount} lines.
2. For each line:
   - If line starts with "@param", "@returns", "@throws", etc.: Keep the tag and parameter name, only translate the description after "-"
   - If line contains code identifiers (variable names, function names): Keep them unchanged
   - Otherwise: Translate the entire line
3. DO NOT use bullet points (-), numbered lists, or any formatting markers
4. DO NOT add explanations or additional content
5. Return ONLY the translated text, one line per line

Input (${lineCount} lines):
${lineByLinePrompt}

Output (${lineCount} lines, translate each line):`;
    } else {
      return `Translate the following text to Chinese.
Keep EXACTLY ${lineCount} lines. Translate line by line. DO NOT use bullet points or numbered lists.
Return ONLY the translation:

${content}`;
    }
  }

  async translate(content: string, options: ITranslateOptions): Promise<string> {
    const { to = 'auto', from } = options;

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

    const hasTags = this.hasJSDocTags(content);
    const lineCount = content.split('\n').length;

    // 输出内容分析
    outputChannel.appendLine(`[SiliconFlow Translate] Content analysis:`);
    outputChannel.appendLine(`  - Has JSDoc tags: ${hasTags}`);
    outputChannel.appendLine(`  - Line count: ${lineCount}`);
    outputChannel.appendLine(`  - Note: Comment Translate will reapply format automatically (like Google Translate)`);

    // 参考 Google Translate：简单直接的系统提示词
    const systemPrompt = hasTags
      ? 'You are a code comment translator. Translate line by line. Preserve JSDoc tags (@param, @returns, etc.) and code identifiers exactly. Keep the same number of lines. Never use bullet points or numbered lists.'
      : 'You are a translator. Translate line by line. Keep the same number of lines. Never use bullet points or numbered lists.';

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
        let translatedText = response.data.choices[0].message.content.trim();

        outputChannel.appendLine(`[SiliconFlow Translate] Translation completed:`);
        outputChannel.appendLine(`  - Translated length: ${translatedText.length} characters`);

        // 参考 Google Translate 的后处理：移除可能的多余空格
        // Google Translate 使用: trans.replace(/((\/|\*|-) )/g, '$2')
        // 我们简化处理：移除行首的项目符号和多余空格
        translatedText = translatedText.split('\n').map(line => {
          // 移除项目符号
          line = line.replace(/^\s*[-•]\s*/, '');
          // 移除行首多余空格（但保留必要的缩进）
          return line.trimStart();
        }).join('\n');

        const originalLines = content.split('\n');
        const translatedLines = translatedText.split('\n');

        outputChannel.appendLine(`  - Original lines: ${originalLines.length}`);
        outputChannel.appendLine(`  - Translated lines: ${translatedLines.length}`);
        outputChannel.appendLine(`  - Preview: ${translatedText.substring(0, 200)}${translatedText.length > 200 ? '...' : ''}`);

        // 验证行结构匹配（关键！Comment Translate 需要行数匹配才能正确应用格式）
        if (originalLines.length !== translatedLines.length) {
          outputChannel.appendLine(`[SiliconFlow Translate] WARNING: Line count mismatch! This may cause format issues.`);
          outputChannel.appendLine(`  - Original: ${originalLines.length} lines`);
          outputChannel.appendLine(`  - Translated: ${translatedLines.length} lines`);

          // 尝试修复：如果翻译结果行数少于原始，可能是合并了空行
          // 如果翻译结果行数多于原始，可能是拆分了行
          // 这里我们尽量保持原始行数
          if (translatedLines.length < originalLines.length) {
            // 翻译结果行数少，可能需要补充空行
            outputChannel.appendLine(`  - Attempting to match line count...`);
            const fixedLines: string[] = [];
            let transIndex = 0;
            for (let i = 0; i < originalLines.length; i++) {
              if (originalLines[i].trim() === '') {
                // 原始是空行，保持空行
                fixedLines.push('');
              } else if (transIndex < translatedLines.length) {
                fixedLines.push(translatedLines[transIndex]);
                transIndex++;
              } else {
                // 翻译结果不够，使用原始行
                fixedLines.push(originalLines[i]);
              }
            }
            translatedText = fixedLines.join('\n');
            outputChannel.appendLine(`  - Fixed to ${fixedLines.length} lines`);
          } else if (translatedLines.length > originalLines.length) {
            // 翻译结果行数多，可能需要合并
            outputChannel.appendLine(`  - Translation has more lines, keeping first ${originalLines.length} lines`);
            translatedText = translatedLines.slice(0, originalLines.length).join('\n');
          }
        }

        // 检查是否仍包含项目符号
        const hasBullets = translatedText.includes('\n-') || translatedText.match(/^\s*[-•]\s/m);
        if (hasBullets) {
          outputChannel.appendLine(`[SiliconFlow Translate] WARNING: Bullet points still detected after cleanup!`);
        }

        // 如果返回的内容包含原始提示词或说明文字，尝试提取纯翻译结果
        const lowerText = translatedText.toLowerCase();
        if (lowerText.includes('translat') || lowerText.includes('翻译') || lowerText.includes('output') || lowerText.includes('输入')) {
          outputChannel.appendLine(`[SiliconFlow Translate] Detected explanation text, attempting to extract translation...`);
          const lines = translatedText.split('\n');
          const filteredLines = lines.filter(line => {
            const lowerLine = line.toLowerCase();
            return !lowerLine.includes('translat') &&
              !lowerLine.includes('翻译') &&
              !lowerLine.includes('output') &&
              !lowerLine.includes('输入') &&
              !lowerLine.includes('line') &&
              !lowerLine.includes('行') &&
              line.trim().length > 0;
          });
          if (filteredLines.length > 0 && filteredLines.length === originalLines.length) {
            translatedText = filteredLines.join('\n');
            outputChannel.appendLine(`  - Extracted ${filteredLines.length} lines`);
          }
        }

        // 返回纯文本翻译（Comment Translate 会自动重新应用格式）
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
