import { ITranslateRegistry } from 'comment-translate-manager';
import * as vscode from 'vscode';
import { SiliconFlowTranslate } from './siliconflowTranslate';

// 创建输出通道用于日志
const outputChannel = vscode.window.createOutputChannel('SiliconFlow Translate');

export function activate(context: vscode.ExtensionContext) {
  outputChannel.appendLine('[SiliconFlow Translate] Extension activated');
  
  // 暴露插件给comment-translate
  return {
    extendTranslate: function (registry: ITranslateRegistry) {
      outputChannel.appendLine('[SiliconFlow Translate] Registering translation service');
      registry('siliconflow', SiliconFlowTranslate);
      outputChannel.appendLine('[SiliconFlow Translate] Translation service registered successfully');
    }
  };
}

// 当扩展被停用时调用
export function deactivate() {
  outputChannel.appendLine('[SiliconFlow Translate] Extension deactivated');
  outputChannel.dispose();
}

// 导出输出通道供其他模块使用
export { outputChannel };
