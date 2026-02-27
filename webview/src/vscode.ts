declare const acquireVsCodeApi: () => any;

export const vscode = acquireVsCodeApi();

export interface VSCodeMessage {
  type: string;
  [key: string]: any;
}
