import * as vscode from "vscode";

export class WebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _onMessageListeners: Array<(message: any) => void> = [];
  private _onReadyListeners: Array<() => void> = [];
  private _pendingMessages: any[] = [];

  constructor(private extensionUri: vscode.Uri) {}

  /**
   * Webview が初期化されたタイミングで HTML を提供し、メッセージの受信・キュー処理を整えます。
   */
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AC Companion</title>
        <link
          rel="stylesheet"
          href="${webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(
              this.extensionUri,
              "media",
              "frontend",
              "main.css"
            )
          )}"
        />
      </head>
      <body>
        <div id="root"></div>
        <script src="${webviewView.webview.asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, "media", "frontend", "main.js")
        )}"></script>
      </body>
      </html>
    `;

    webviewView.webview.onDidReceiveMessage((message) => {
      this._onMessageListeners.forEach((listener) => listener(message));
    });

    if (this._pendingMessages.length > 0) {
      for (const message of this._pendingMessages) {
        this._view?.webview.postMessage(message);
      }
      this._pendingMessages = [];
    }

    this._onReadyListeners.forEach((listener) => listener());
  }

  /**
   * Webview からのメッセージを受け取ったときに呼び出すリスナーを登録します。
   */
  public onDidReceiveMessage(listener: (message: any) => void) {
    this._onMessageListeners.push(listener);
  }

  /**
   * Webview が ready 状態になった際に実行するコールバックを登録します。
   */
  public onReady(listener: () => void) {
    this._onReadyListeners.push(listener);
  }

  /**
   * Webview にメッセージを送信します。View がまだ用意できていない場合はキューに貯めます。
   */
  public postMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
      return;
    }
    this._pendingMessages.push(message);
  }
}
