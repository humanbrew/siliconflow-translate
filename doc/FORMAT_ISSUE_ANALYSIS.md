# 注释格式保留问题分析

## 问题描述

用户发现某些注释翻译后没有保留原始格式，而另一些注释可以正确保留格式。

### 观察到的现象

1. **问题注释**（第一张图片）：
   - 翻译结果使用了项目符号格式（`\n-`）
   - 没有保留 JSDoc 的 `* @param` 格式
   - API 返回的内容本身就包含了 `\n-` 字符

2. **正常注释**（第二张图片）：
   - `addOnce` 函数的注释正确保留了 JSDoc 格式
   - `/**`, `*`, `@param`, `@returns` 都正确保留

## 可能的原因

### 1. 格式检测问题

**当前检测逻辑**：
```typescript
private isCommentFormat(text: string): boolean {
  if (text.trim().startsWith('/**') || text.includes('*/')) {
    return true;
  }
  // ...
}
```

**潜在问题**：
- 如果注释文本被提取时格式不完整（例如缺少 `/**` 开头）
- 如果注释包含特殊字符或格式
- 检测可能不够严格

### 2. 提示词不够强

**当前提示词**：
```
1. Preserve ALL comment structure exactly (/** */, //, /* */, #, etc.)
2. Preserve ALL JSDoc tags (@param, @returns, @private, etc.) - DO NOT translate them
3. Preserve parameter names, variable names, and code identifiers - DO NOT translate them
4. Preserve line prefixes like "* " in JSDoc comments
5. Only translate descriptive text, not code elements
6. Maintain the exact same line structure and indentation
7. Return ONLY the translated comment, no explanations
```

**问题**：
- 虽然要求保留格式，但模型可能在某些情况下会"优化"格式
- 对于复杂的 JSDoc 注释，模型可能会改变格式以提高可读性
- 没有明确禁止使用项目符号或其他格式

### 3. 模型行为不一致

- 某些模型（如 Qwen）可能会：
  - 将列表格式化为项目符号
  - 改变 JSDoc 的结构以提高可读性
  - 在某些情况下忽略格式要求

### 4. 后处理缺失

- 当前实现直接返回 API 的响应
- 没有对返回结果进行格式验证和修正
- 如果模型返回了错误格式，无法自动修复

## 解决方案

### 方案1：增强提示词（推荐）

在提示词中更明确地要求保留格式，并添加示例：

```typescript
if (isComment) {
  return `Translate the following code comment to ${targetLangName}. CRITICAL FORMATTING RULES:

1. You MUST preserve the EXACT comment structure:
   - Keep /** at the start and */ at the end
   - Keep * prefix on each line inside the comment block
   - Keep @param, @returns, @throws, etc. tags EXACTLY as they are
   - Keep parameter names, variable names, and code identifiers UNCHANGED

2. DO NOT change the format:
   - DO NOT use bullet points (-) or numbered lists
   - DO NOT change the line structure
   - DO NOT add or remove line breaks
   - DO NOT reformat the comment

3. ONLY translate the descriptive text after tags:
   - Translate: "@param name - description" → "@param name - 描述"
   - DO NOT translate: "@param", "name", "-"
   - DO NOT translate: "@returns", "@throws", etc.

4. Example:
   Original:
   /**
    * Function description
    * @param param1 - parameter description
    * @returns return description
    */
   
   Translated (Chinese):
   /**
    * 函数描述
    * @param param1 - 参数描述
    * @returns 返回值描述
    */

Original comment to translate:
${content}`;
}
```

### 方案2：添加格式后处理

检测返回结果是否保留了格式，如果没有，尝试修复：

```typescript
// 检查返回结果是否保留了 JSDoc 格式
if (isComment && content.includes('/**')) {
  // 检查返回结果是否也包含 /**
  if (!translatedText.includes('/**')) {
    outputChannel.appendLine(`[SiliconFlow Translate] WARNING: Format not preserved, attempting to fix...`);
    // 尝试修复格式
    translatedText = this.fixCommentFormat(translatedText, content);
  }
  
  // 检查是否使用了项目符号（不应该）
  if (translatedText.includes('\n-') || translatedText.match(/^\s*-\s/m)) {
    outputChannel.appendLine(`[SiliconFlow Translate] WARNING: Bullet points detected, attempting to fix...`);
    translatedText = this.convertBulletsToJSDoc(translatedText, content);
  }
}
```

### 方案3：降低 Temperature

降低 Temperature 值，使模型输出更确定、更遵循格式要求：

- 当前默认：0.3
- 建议：0.1-0.2（更保守，更遵循格式）

### 方案4：使用更严格的模型

某些模型对格式保留更好：
- 使用专门针对代码的模型
- 或者使用更强大的模型（如果可用）

## 推荐的修复方案

结合使用：
1. ✅ **增强提示词**：更明确的要求和示例
2. ✅ **添加格式检测和修复**：后处理确保格式正确
3. ✅ **降低 Temperature**：提高格式一致性
4. ✅ **添加详细日志**：记录格式检测结果
