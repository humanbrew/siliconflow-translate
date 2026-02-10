# VS Code 调试配置详细分析

本文档详细分析 `.vscode` 目录中的配置文件，以及按下 F5 后的执行流程。

## 文件概览

### 1. `launch.json` - 调试启动配置
### 2. `tasks.json` - 构建任务配置（当前使用）
### 3. `tasks-yarn.json.example` - Yarn 版本的示例配置（未使用）

---

## 一、launch.json 详细分析

### 文件作用
`launch.json` 定义了 VS Code 的调试配置，告诉 VS Code **如何启动和调试扩展**。

### 配置结构

```json
{
  "version": "0.2.0",  // VS Code 调试配置格式版本
  "configurations": [  // 调试配置数组，可以有多个配置
    {
      "name": "Run Extension",  // 配置名称，显示在调试下拉菜单中
      "type": "extensionHost",  // 调试器类型：扩展主机模式
      "request": "launch",      // 启动方式：launch（启动）或 attach（附加）
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"  // 传递给扩展主机的参数
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"  // 编译后的 JS 文件位置，用于源码映射
      ],
      "preLaunchTask": "${defaultBuildTask}"  // ⚠️ 关键：启动前执行的任务
    }
  ]
}
```

### 关键字段解析

#### 1. `"type": "extensionHost"`
- **作用**：指定这是一个 VS Code 扩展调试配置
- **含义**：VS Code 会启动一个新的扩展开发主机窗口来运行扩展
- **效果**：按 F5 后会打开一个新的 VS Code 窗口（Extension Development Host）

#### 2. `"request": "launch"`
- **作用**：启动方式
- **launch**：启动新进程（用于扩展开发）
- **attach**：附加到已运行的进程（用于调试已安装的扩展）

#### 3. `"args": ["--extensionDevelopmentPath=${workspaceFolder}"]`
- **作用**：传递给扩展开发主机的命令行参数
- **`${workspaceFolder}`**：VS Code 变量，表示当前工作区文件夹的绝对路径
- **含义**：告诉扩展主机从哪个目录加载扩展代码

#### 4. `"outFiles": ["${workspaceFolder}/out/**/*.js"]`
- **作用**：指定编译后的 JavaScript 文件位置
- **用途**：
  - 用于源码映射（Source Map），将编译后的代码映射回 TypeScript 源码
  - 支持在 TypeScript 源码中设置断点
- **`**/*.js`**：匹配 `out` 目录下所有子目录的 `.js` 文件

#### 5. `"preLaunchTask": "${defaultBuildTask}"` ⚠️ **最关键**
- **作用**：在启动调试**之前**执行的任务
- **`${defaultBuildTask}`**：VS Code 变量，指向 `tasks.json` 中标记为 `"isDefault": true` 的任务
- **执行时机**：在打开扩展开发主机窗口**之前**
- **目的**：确保代码已编译，扩展主机能加载最新的代码

---

## 二、tasks.json 详细分析

### 文件作用
`tasks.json` 定义了 VS Code 的**构建任务**，告诉 VS Code **如何编译和构建项目**。

### 配置结构

```json
{
  "version": "2.0.0",  // VS Code 任务配置格式版本
  "tasks": [  // 任务数组
    {
      "label": "watch",  // 任务标签，用于引用
      "type": "shell",   // 任务类型：shell 命令
      "command": "npm run watch",  // 执行的命令
      "problemMatcher": "$tsc-watch",  // 问题匹配器：监听 TypeScript 编译错误
      "isBackground": true,  // 后台任务：不会阻塞
      "presentation": {
        "reveal": "never"  // 不自动显示终端
      },
      "group": {
        "kind": "build",  // 任务组：构建任务
        "isDefault": true  // ⚠️ 关键：标记为默认构建任务
      }
    }
  ]
}
```

### 任务1：watch（监听模式）

```json
{
  "label": "watch",
  "type": "shell",
  "command": "npm run watch",
  "problemMatcher": "$tsc-watch",
  "isBackground": true,
  "presentation": {
    "reveal": "never"
  },
  "group": {
    "kind": "build",
    "isDefault": true  // ⚠️ 这个标记让 launch.json 能找到它
  }
}
```

#### 字段解析

- **`"label": "watch"`**
  - 任务标识符，`launch.json` 可以通过这个名称引用任务
  - 显示在"运行任务"命令列表中

- **`"type": "shell"`**
  - 任务类型：执行 shell 命令
  - 其他类型：`npm`（自动检测包管理器）、`process`（进程）等

- **`"command": "npm run watch"`**
  - 实际执行的命令
  - 对应 `package.json` 中的 `"watch": "tsc -watch -p ./"`
  - `tsc -watch` 会持续监听文件变化并自动重新编译

- **`"problemMatcher": "$tsc-watch"`**
  - 问题匹配器：解析 TypeScript 编译器的输出
  - `$tsc-watch`：VS Code 内置的匹配器，用于监听模式的 TypeScript
  - **作用**：将编译错误显示在"问题"面板中，支持点击跳转到错误位置

- **`"isBackground": true`**
  - **关键**：标记为后台任务
  - **含义**：任务会持续运行（`tsc -watch` 不会退出）
  - **效果**：VS Code 不会等待任务完成，而是立即继续执行后续步骤
  - **必须配合 `problemMatcher`**：让 VS Code 知道任务何时"就绪"（即使还在运行）

- **`"presentation": { "reveal": "never" }`**
  - 终端显示策略
  - `"never"`：不自动显示终端（即使任务在运行）
  - 其他选项：`"always"`（总是显示）、`"silent"`（静默）

- **`"group": { "kind": "build", "isDefault": true }`**
  - **`"kind": "build"`**：任务组类型，标记为构建任务
  - **`"isDefault": true`**：⚠️ **最关键**
    - 标记为默认构建任务
    - `launch.json` 中的 `"${defaultBuildTask}"` 会引用这个任务
    - 可以通过 `Ctrl+Shift+B`（Mac: `Cmd+Shift+B`）快速运行

### 任务2：compile（编译任务）

```json
{
  "label": "compile",
  "type": "shell",
  "command": "npm run compile",
  "problemMatcher": "$tsc",
  "presentation": {
    "reveal": "never"
  },
  "group": "build"
}
```

#### 与 watch 的区别

- **`"command": "npm run compile"`**
  - 执行 `tsc -p ./`（一次性编译，不监听）

- **`"problemMatcher": "$tsc"`**
  - 用于一次性编译的问题匹配器（不是 `$tsc-watch`）

- **`"isBackground": false`**（默认）
  - 不是后台任务，会等待编译完成

- **没有 `"isDefault": true`**
  - 不是默认任务，不会被 `preLaunchTask` 自动调用
  - 可以手动运行：`Ctrl+Shift+P` → "运行任务" → "compile"

---

## 三、tasks-yarn.json.example 分析

### 文件作用
这是使用 Yarn 包管理器的示例配置，**当前未使用**。

### 与 tasks.json 的区别

| 字段 | tasks.json | tasks-yarn.json.example |
|------|-----------|------------------------|
| `command` | `npm run watch` | `yarn watch` |
| `command` | `npm run compile` | `yarn compile` |

### 何时使用
如果项目使用 Yarn（存在 `yarn.lock`），可以：
1. 将 `tasks-yarn.json.example` 重命名为 `tasks.json`
2. 或者直接修改 `tasks.json` 中的命令为 `yarn`

---

## 四、F5 执行流程详解

### 完整执行流程

```
用户按下 F5
    ↓
VS Code 读取 launch.json
    ↓
找到 "Run Extension" 配置
    ↓
检查 "preLaunchTask": "${defaultBuildTask}"
    ↓
查找 tasks.json 中 "isDefault": true 的任务
    ↓
找到 "watch" 任务
    ↓
执行任务：npm run watch
    ↓
启动 tsc -watch -p ./
    ↓
TypeScript 编译器开始监听文件变化
    ↓
problemMatcher 检测到编译就绪（即使还在监听）
    ↓
preLaunchTask 完成（后台任务继续运行）
    ↓
启动扩展开发主机（Extension Host）
    ↓
传递参数：--extensionDevelopmentPath=${workspaceFolder}
    ↓
打开新的 VS Code 窗口（Extension Development Host）
    ↓
新窗口加载扩展：./out/extension.js
    ↓
扩展激活，可以开始调试
```

### 关键时间点

#### 1. **preLaunchTask 阶段**
```
时间：F5 按下后，扩展窗口打开前
任务：执行 "watch" 任务
命令：npm run watch → tsc -watch -p ./
状态：后台运行，持续监听文件变化
```

#### 2. **问题匹配器（Problem Matcher）的作用**
```
tsc -watch 输出编译信息
    ↓
problemMatcher: "$tsc-watch" 解析输出
    ↓
检测到编译完成（即使还在监听模式）
    ↓
通知 VS Code：任务"就绪"
    ↓
VS Code 继续执行 preLaunchTask 的后续步骤
```

**为什么需要 `isBackground: true` + `problemMatcher`？**
- `tsc -watch` 不会退出，会一直运行
- 如果不标记为后台任务，VS Code 会一直等待任务"完成"（永远不会）
- `problemMatcher` 告诉 VS Code：虽然任务还在运行，但编译已经就绪，可以继续

#### 3. **扩展加载阶段**
```
新窗口启动
    ↓
读取 --extensionDevelopmentPath 参数
    ↓
找到扩展目录：${workspaceFolder}
    ↓
查找 main 字段：package.json → "main": "./out/extension.js"
    ↓
加载扩展：./out/extension.js
    ↓
执行 activate() 函数
    ↓
扩展注册翻译服务
    ↓
扩展就绪，可以开始使用
```

### 变量替换

VS Code 会在执行时替换以下变量：

| 变量 | 实际值 | 示例 |
|------|--------|------|
| `${workspaceFolder}` | 工作区文件夹绝对路径 | `/Users/frog/Desktop/.../siliconflow-translate` |
| `${defaultBuildTask}` | 默认构建任务的 label | `"watch"` |

---

## 五、配置文件的协同工作

### 关系图

```
launch.json (调试配置)
    │
    │ preLaunchTask: "${defaultBuildTask}"
    │
    └─→ tasks.json (构建任务)
           │
           │ isDefault: true
           │
           └─→ "watch" 任务
                  │
                  │ command: "npm run watch"
                  │
                  └─→ package.json
                         │
                         │ scripts.watch: "tsc -watch -p ./"
                         │
                         └─→ tsconfig.json
                                │
                                └─→ 编译 TypeScript → out/
```

### 数据流

```
1. launch.json 定义"如何启动"
   └─→ 需要先执行构建任务

2. tasks.json 定义"如何构建"
   └─→ 执行 npm 脚本

3. package.json 定义"构建命令"
   └─→ 调用 TypeScript 编译器

4. tsconfig.json 定义"编译配置"
   └─→ 输出到 out/ 目录

5. launch.json 加载编译后的文件
   └─→ out/extension.js
```

---

## 六、常见问题和解决方案

### 问题1：preLaunchTask 找不到默认任务

**症状**：`Could not find the task '${defaultBuildTask}'`

**原因**：
- `tasks.json` 中没有 `"isDefault": true` 的任务
- `tasks.json` 文件不存在或格式错误

**解决**：
- 确保 `tasks.json` 中有任务设置了 `"isDefault": true`

### 问题2：任务执行失败

**症状**：`The preLaunchTask "watch" terminated with exit code 1`

**原因**：
- `npm run watch` 命令失败
- TypeScript 编译错误
- 包管理器不匹配（npm vs yarn vs pnpm）

**解决**：
- 检查终端输出中的错误信息
- 确保 `package.json` 中有对应的脚本
- 确保已安装依赖：`npm install`

### 问题3：扩展窗口打开但扩展未加载

**症状**：新窗口打开，但扩展功能不可用

**原因**：
- `out/extension.js` 不存在或编译失败
- `package.json` 中的 `main` 字段路径错误

**解决**：
- 检查 `out/` 目录是否存在编译后的文件
- 手动运行 `npm run compile` 查看错误
- 检查 `package.json` 的 `main` 字段

### 问题4：断点不生效

**症状**：设置了断点，但调试时不停止

**原因**：
- `outFiles` 配置不正确
- 源码映射（Source Map）未生成

**解决**：
- 检查 `tsconfig.json` 中 `"sourceMap": true`
- 确保 `launch.json` 的 `outFiles` 路径正确
- 重新编译：`npm run compile`

---

## 七、最佳实践

### 1. 开发时使用 watch 模式
- **优点**：文件修改后自动重新编译
- **配置**：`tasks.json` 中 `watch` 任务设为默认

### 2. 发布前使用 compile 模式
- **优点**：一次性编译，确保没有错误
- **方法**：手动运行 `npm run compile`

### 3. 调试配置分离
- **开发配置**：`launch.json` 中的 "Run Extension"
- **测试配置**：`launch.json` 中的 "Extension Tests"

### 4. 包管理器一致性
- 如果使用 `yarn.lock`，使用 `yarn` 命令
- 如果使用 `package-lock.json`，使用 `npm` 命令
- 避免混用，避免 `pnpm` 配置冲突

---

## 八、总结

### 核心概念

1. **launch.json**：定义"如何启动调试"
2. **tasks.json**：定义"如何构建项目"
3. **preLaunchTask**：连接两者的桥梁
4. **isDefault**：标记默认任务
5. **isBackground + problemMatcher**：处理持续运行的任务

### F5 执行的关键步骤

1. ✅ 查找默认构建任务
2. ✅ 执行构建任务（编译 TypeScript）
3. ✅ 等待编译就绪（通过 problemMatcher）
4. ✅ 启动扩展开发主机
5. ✅ 加载扩展代码
6. ✅ 开始调试

### 配置文件的作用

- **launch.json**：调试配置
- **tasks.json**：构建配置
- **package.json**：项目配置和脚本
- **tsconfig.json**：TypeScript 编译配置

这些文件协同工作，实现了"一键调试"的功能！
