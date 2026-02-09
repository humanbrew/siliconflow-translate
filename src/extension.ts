import { ITranslateRegistry } from 'comment-translate-manager';
import * as vscode from 'vscode';
import { SiliconFlowTranslate } from './siliconflowTranslate';

export function activate(context: vscode.ExtensionContext) {
  // 暴露插件给comment-translate
  return {
    extendTranslate: function (registry: ITranslateRegistry) {
      registry('siliconflow', SiliconFlowTranslate);
    }
  };
}

// 当扩展被停用时调用
export function deactivate() {}
