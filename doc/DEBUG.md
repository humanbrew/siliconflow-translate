# 调试指南

## 快速开始

### 1. 准备工作

确保已安装：
- Node.js
- VS Code
- Comment Translate 插件（在调试窗口中需要安装）

### 2. 安装依赖

```bash
npm install
```

### 3. 编译项目

```bash
npm run compile
```

### 4. 启动调试

1. 在VS Code中打开本项目
2. 按 `F5` 启动调试
3. 会打开一个新的VS Code窗口（Extension Development Host）

### 5. 在新窗口中测试

#### 安装Comment Translate插件

在新窗口中：
1. 打开扩展市场（`Ctrl+Shift+X` 或 `Cmd+Shift+X`）
2. 搜索 `Comment Translate`
3. 点击安装

#### 配置翻译源

1. 打开命令面板（`Ctrl+Shift+P` 或 `Cmd+Shift+P`）
2. 输入 `Comment Translate: Change translation source`
3. 选择 `SiliconFlow Translate`

#### 配置API密钥

1. 打开设置（`Ctrl+,` 或 `Cmd+,`）
2. 搜索 `siliconflowTranslate`
3. 配置以下项：
   - `siliconflowTranslate.apiKey`: 您的API密钥
   - `siliconflowTranslate.model`: 模型名称（如 `Qwen/Qwen2.5-7B-Instruct`）

#### 测试翻译

1. 打开任意代码文件
2. 将鼠标悬停在注释上查看翻译
3. 或选中文本，使用翻译命令

## 调试技巧

### 查看日志

- 在原始VS Code窗口的"调试控制台"（Debug Console）中查看日志
- 扩展的输出会显示在这里

### 热重载

修改代码后：
1. 停止调试（`Shift+F5`）
2. 重新编译（`npm run compile`）
3. 重新启动调试（`F5`）

或者在新窗口中按 `Ctrl+R`（Mac: `Cmd+R`）重新加载扩展。

### 设置断点

在代码中点击行号左侧设置断点，可以：
- 单步执行
- 查看变量值
- 检查调用栈

## 常见问题排查

### 问题1：找不到翻译源

**症状**：在"Change translation source"列表中看不到"SiliconFlow Translate"

**解决方案**：
1. 检查是否已编译：`npm run compile`
2. 检查 `out/extension.js` 是否存在
3. 查看调试控制台的错误信息
4. 确保 `package.json` 中的 `main` 字段指向正确路径

### 问题2：翻译失败

**症状**：翻译时出现错误

**解决方案**：
1. 检查API密钥是否正确配置
2. 检查网络连接
3. 查看调试控制台的详细错误信息
4. 验证API地址是否正确

### 问题3：扩展未激活

**症状**：扩展似乎没有运行

**解决方案**：
1. 检查 `extensionDependencies` 中是否包含 `intellsmi.comment-translate`
2. 确保在新窗口中已安装 Comment Translate 插件
3. 查看调试控制台是否有激活错误

## 调试配置说明

项目包含以下调试配置文件：

- `.vscode/launch.json`: 调试启动配置
- `.vscode/tasks.json`: 构建任务配置

这些文件已自动创建，可以直接使用 `F5` 启动调试。

## 发布扩展（可选）

调试完成后，如果想发布到VS Code市场：

1. 安装 `vsce`：`npm install -g vsce`
2. 打包：`vsce package`
3. 发布：`vsce publish`

但**调试和测试不需要发布**，本地调试即可！
