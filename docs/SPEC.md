# AC Companion 仕様書

この文書は、AtCoder 等の問題ページから Competitive Companion 経由でテストケースを取得し、VS Code でローカル実行・検証できる拡張機能「AC Companion」の仕様書です。実装済み機能を踏まえ、今後の詳細設計・実装に必要な要件を整理します。

本仕様はユーザー回答を反映済みです。未確定事項は「将来検討・補足」を参照してください。実装計画は `docs/PLAN.md`、メッセージ仕様は `docs/PROTOCOL.md`、設定は `docs/CONFIG.md`、テスト手順は `docs/TESTING.md`、UI は `docs/UI.md`、マージ方針は `docs/MERGE_POLICY.md` を参照してください。貢献フローは `docs/CONTRIBUTING.md` に記載しています。

## 概要

- ブラウザ拡張 Competitive Companion が POST する問題情報をローカル HTTP サーバーで受信
- 受信したテストケースを `コンテストID/タスクID/<保存ディレクトリ名>` に `.in/.out` で保存
- コードテンプレート（Python）を `コンテストID/タスクID/main.py` として配置し、エディタで自動オープン
- Sidebar（Webview）で問題名・テストケース一覧を表示し、ローカル実行して Expected/Actual/Console を確認
- 実行言語は Python。CPython と PyPy を切り替え可能

## 対象・前提

- 対象サイト: Competitive Companion が対応する AtCoder（他サイトも将来拡張で検討）
- VS Code 拡張機能として実装（TypeScript）
- 取得済み: テストケース受信と保存、テンプレート自動コピー、エディタでのテンプレートオープン

## データモデル（Competitive Companion JSON）

`format_example.json` の内容を以下に転写します。

```json
{
  "name": "G. Castle Defense",
  "group": "Codeforces - Educational Codeforces Round 40 (Rated for Div. 2)",
  "url": "https://codeforces.com/problemset/problem/954/G",
  "interactive": false,
  "memoryLimit": 256,
  "timeLimit": 1500,
  "tests": [
    {
      "input": "5 0 6\n5 4 3 4 9\n",
      "output": "5\n"
    },
    {
      "input": "4 2 0\n1 2 3 4\n",
      "output": "6\n"
    },
    {
      "input": "5 1 1\n2 1 2 1 2\n",
      "output": "3\n"
    }
  ],
  "testType": "single",
  "input": {
    "type": "stdin"
  },
  "output": {
    "type": "stdout"
  },
  "languages": {
    "java": {
      "mainClass": "Main",
      "taskClass": "GCastleDefense"
    }
  },
  "batch": {
    "id": "123e67c8-03c6-44a4-a3f9-5918533f9fb2",
    "size": 1
  }
}
```

本拡張では主に以下を利用します:

- `name`, `group`, `url`, `interactive`, `timeLimit`, `tests[]`（`input`, `output`）

## ファイル配置

- ベースディレクトリ: VS Code ワークスペースルート
- 保存構造: `/<contestId>/<taskId>/<testsDir>/`
  - `testsDir` 既定値: `tests`（設定で変更可能）
  - テストケース: `1.in`, `1.out`, `2.in`, `2.out`, ...
- ソリューション: `/<contestId>/<taskId>/main.py`
- コンテスト ID / タスク ID 抽出: URL の `.../contests/<contestId>/tasks/<taskId>` から抽出

## 設定項目（確定）

- `ac-companion.port`（既存）: 受信ポート。既定 `10043`
- `ac-companion.testCaseSaveDirName`（既存）: テスト保存ディレクトリ。既定 `tests`
- `ac-companion.templateFilePath`（既存）: テンプレートパス。既定 `.config/templates/main.py`
- `ac-companion.interpreter`（新規）: `"cpython" | "pypy"`（既定 `cpython`）
- `ac-companion.pythonCommand`（新規）: CPython の実行コマンド。既定 `python`
- `ac-companion.pypyCommand`（新規）: PyPy の実行コマンド。既定 `pypy3`
- `ac-companion.runCwdMode`（新規）: 実行カレントディレクトリの選択。
  - 既定は `"workspace"`（ワークスペースルート）。オプションとして `"task"`（`/<contestId>/<taskId>`）も許容可能だが、初期実装では `workspace` 固定でよい。
- `ac-companion.timeoutMs`（新規）: ローカル実行のタイムアウト（ms）。未指定時は `ceil(timeLimit * 1.2)` を適用
- `ac-companion.compare.mode`（新規）: 出力比較モード。
  - 既定は `"exact"`。必要に応じて `"trim"` / `"tokens"` を将来追加
- `ac-companion.compare.caseSensitive`（新規）: 大文字小文字の区別（既定 `true`）

## テスト実行仕様（確定）

- 実行対象: `/<contestId>/<taskId>/main.py`（存在する場合のテンプレート上書きは行わずスキップ）
- 入力: 各 `n.in` を子プロセスの stdin にそのままパイプ
- 出力: stdout をキャプチャし、比較仕様に従って `n.out` と照合
- Console: stderr を保持し、失敗時に表示（stdout は Actual として表示）
- Console の既知ノイズ抑制: PyPy 実行時に発生し得る CPU キャッシュ検出関連の警告（例: `Warning: cannot find your CPU L2 & L3 cache size ...`）は非表示にフィルタ
- タイムアウト: `timeoutMs ?? ceil(timeLimit * 1.2)` を基準に個別ケースで適用
- 終了コード: `0` 以外は失敗と見なす（例外/RE）
- 実行順序: 初期実装は直列実行。後続コミットで並列化を検討・実装
- インタラクティブ問題: `interactive === true` は非対応として実行対象外（UI で注意表示）

## 文字列比較仕様（確定）

- 共通前処理: 改行は `\r\n` → `\n` に正規化
- 既定: `exact`（文字列完全一致）
- `trim`: 各行の末尾空白を削除、末尾の空行差分も無視して行単位で一致判定
- `tokens`: 空白（空白/タブ/改行）で分割しトークン列の一致を判定（将来オプション）

## UI 仕様（Sidebar）

- ヘッダー
  - 問題名（`name`）とグループ（`group`）
  - 言語切替（CPython / PyPy トグル）
  - 「全テスト実行」ボタン
- テストケース一覧（折りたたみ可）
  - 各ケースで表示: `#n`, Expected（省略表示/展開）、Actual（実行後）、判定（Pass/Fail/Timeout/RE）
  - 各ケースの操作: 「このケースを実行」ボタン
- 実行後に表示
  - Actual: 実際の標準出力（失敗時は常に表示、成功時は折りたたみ）
  - Console: 標準エラー出力・例外メッセージ・スタックトレース（失敗時のみ表示、既知ノイズは非表示）
- 実行中インジケータとキャンセル（停止）ボタン

## コマンド

- 既存
  - `AC Companion: Start` / `Stop`
- 追加（提案）
  - `AC Companion: Run All Tests`
  - `AC Companion: Run Test Under Cursor`（将来）
  - `AC Companion: Switch Interpreter (CPython/PyPy)`

## エラーハンドリング（確定）

- 受信時
  - URL 不正、workspace 未設定、contestId/taskId 抽出不可 → HTTP 4xx/5xx と VS Code 通知
- 保存時
  - テンプレートコピー: 既に `main.py` が存在する場合はスキップ（上書きしない）
  - テストケース: 既存 `n.in/out` は保持し、新規は末尾採番で追記（マージ）。上書きは行わない
- 実行時
  - タイムアウト、RE、ゼロ長出力、文字化け（エンコーディングは UTF-8 を前提）
  - Console に stderr を保存し UI に提示

## 対応環境 / ビルド

- OS: 初期ターゲットは devcontainer 上の Ubuntu。将来的に Windows/macOS への拡張を検討
- Python 実行コマンド: CPython は `python`、PyPy は `pypy3`
- VS Code `^1.105.0`
- Node.js/TypeScript によるビルド。Webview フロントエンドはバンドル済み `media/frontend/main.js` を読み込み

## 結果の保持

- 実行結果の永続化は行わず、拡張機能動作中のメモリに保持（セッションを跨いだ永続化なし）

## 開発・Agent 実行の注意点

- 仕様合意後に実装を開始する（本時点では実装着手しない）
- 作業は必ず新しい作業ブランチを切って行う
- 意味のある粒度で定期的にコミットし、進捗を可視化する
- 実装の大きなステップ前後でコミットを分け、レビューしやすくする
- 並列化などの最適化は直列版の安定化・コミット後に別コミット/PR で対応

### 実装上の注意

- 保守しやすいように責務ごとに分割する（例）
  - 受信サーバー（POST 受信）
  - テストケース永続化（マージ方針の実装）
  - ランナー（プロセス起動・タイムアウト・stderr フィルタ）
  - 比較器（exact 比較、将来の trim/tokens 拡張点）
  - 設定読み取りと実行時解決（interpreter/timeout/cwd）
  - Webview メッセージング（プロトコル実装）
  - 状態管理（メモリ保持）
  - UI コンポーネント（ヘッダー/テスト行/結果表示）
- 適宜、日本語のコメントや JSDoc を追加して意図を明確化する
  - 例: 公開関数・クラス・複雑なロジックには `/** ... */` で JSDoc を付与
  - コメントは日本語（必要に応じて英語併記可）で簡潔に

## 将来検討・補足

- 出力比較モードの追加（`trim`/`tokens`）と設定 UI 化
- 並列実行の導入（ワーカー数設定、UI の進捗表示の最適化）
- Windows/macOS でのコマンド名解決（`python` vs `python3`）やパス解決
- 実行結果の永続化（必要になった場合にオプション化）

---

本仕様はユーザー回答を反映しています。実装開始前に追加の要望があればお知らせください。
