# SiliconFlow Translate

硅基流动翻译源，用于 [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate) 插件。

## 功能特性

- ✅ 使用硅基流动API进行高质量翻译
- ✅ 支持多种模型选择（包括免费模型）
- ✅ 可配置API密钥和自定义API地址
- ✅ 支持Temperature等参数调整
- ✅ 支持思考过程输出（适用于支持的模型）

## 前置要求

请先安装 [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate) 插件。

## 使用方法

1. 安装本扩展
2. 在VS Code中调用 "Change translation source" 命令（Comment Translate插件提供）
3. 选择 "SiliconFlow Translate"
4. 配置API密钥和模型

## 配置说明

### API密钥

在VS Code设置中配置 `siliconflowTranslate.apiKey`，您可以在[硅基流动控制台](https://cloud.siliconflow.cn/account/ak)获取API Key。

### 模型选择

配置 `siliconflowTranslate.model`，可以选择以下模型：

**免费模型（推荐）：**
- `Qwen/Qwen2.5-7B-Instruct`
- `Qwen/Qwen2.5-14B-Instruct`
- 其他小于10B的模型

**收费模型：**
- `Pro/zai-org/GLM-4.7`
- `deepseek-ai/DeepSeek-V3.2`
- 其他Pro模型

查看[完整模型列表](https://cloud.siliconflow.cn/sft-d29cs9gh3vvc73c59kb0/models?types=chat)

### 其他配置项

- `siliconflowTranslate.apiUrl`: 自定义API接口地址（默认：`https://api.siliconflow.cn/v1/chat/completions`）
- `siliconflowTranslate.temperature`: 控制回复的随机性（0-2，默认：0.3）
- `siliconflowTranslate.enableThinking`: 是否启用思考过程输出（默认：false）
- `siliconflowTranslate.maxTokens`: 生成的最大token数（默认：2000）

## 配置示例

在VS Code的 `settings.json` 中添加：

```json
{
  "siliconflowTranslate.apiKey": "your-api-key-here",
  "siliconflowTranslate.model": "Qwen/Qwen2.5-7B-Instruct",
  "siliconflowTranslate.temperature": 0.3,
  "siliconflowTranslate.enableThinking": false,
  "siliconflowTranslate.maxTokens": 2000
}
```

## 许可证

MIT

## 相关链接

- [Comment Translate 插件](https://github.com/intellism/vscode-comment-translate)
- [硅基流动API文档](https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions)
- [硅基流动控制台](https://cloud.siliconflow.cn/)
