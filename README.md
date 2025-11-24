# AC Companion Python

AC Companion Python は、AtCoder の問題ページから取得したサンプルテストケースを VS Code ワークスペース内に自動保存し、サイドバーから素早くローカル実行できる拡張機能です。Competitive Companion ブラウザ拡張が解析した問題情報を受け取り、コンテスト ID／タスク ID ごとに整理して配置します。

## Features

- Competitive Companion からの POST をローカルサーバーで受信し自動保存
- `コンテストID/タスクID/<保存ディレクトリ名>` 構造で `.in/.out` を作成
- テンプレート `main.py` を自動配置（未存在のときのみ）し、エディタで自動オープン＋`pass` を選択
- サイドバー（ACCP Panel）でテスト一覧を表示し、Run All / 各テストの実行が可能
- インタプリタを CPython / PyPy / Codon で切替（サイドバーからワンクリック）
- 出力の比較（完全一致、大小文字の判定切替）と結果の表示（AC/WA/TLE/RE）
- コマンドパレット: Start/Stop/Run All/Run Test を提供
- 既存のテストがある場合、再インポートでは上書きせずスキップ

## Requirements

1. Competitive Companion（ブラウザ拡張）

- 設定の「Custom test case endpoints」に `http://127.0.0.1:10043/`（または本拡張のポート設定）を追加
- 対応サイトとして AtCoder を有効化

2. VS Code ワークスペース

- 目的の保存先フォルダをワークスペースとして開いてください

## Quick Start

1. VS Code でワークスペースを開く
2. コマンドパレットから「AC Companion Python: Start」を実行（起動済みなら不要）
3. ブラウザで AtCoder の問題ページを開き、Competitive Companion の送信ボタンを押す
4. `/<contestId>/<taskId>/` に `tests/` と `main.py`（未存在時のみ）が作成されます
5. VS Code 左側の「AC Companion Python」ビュー（ACCP Panel）でテストを実行

## Directory Layout

```
/<workspace>/
  <contestId>/
    <taskId>/
      main.py
      <testsDir>/
        1.in
        1.out
        2.in
        2.out
        ...
```

既定の `<testsDir>` は `tests`、テンプレートは `.config/templates/main.py` を参照します。テンプレートは自動生成されないため、必要なら事前に用意してください。

## Commands

- `AC Companion Python: Start` サーバーを起動
- `AC Companion Python: Stop` サーバーを停止
- `AC Companion Python: Run All Tests` すべてのテストを実行
- `AC Companion Python: Run Test` インデックスを指定して 1 件実行

サイドバー（ACCP Panel）からも Run All／各テストの実行、インタプリタ切替が可能です。

## Settings

- `ac-companion-python.port` (default: `10043`)
  - Competitive Companion が POST するポート番号
- `ac-companion-python.testCaseSaveDirName` (default: `tests`)
  - テストケースを保存するディレクトリ名（なければ自動作成）
- `ac-companion-python.templateFilePath` (default: `.config/templates/main.py`)
  - `main.py` が未存在のときにコピーするテンプレートのパス
- `ac-companion-python.interpreter` (default: `cpython`)
  - 使用インタプリタ（`cpython` / `pypy` / `codon`）
- `ac-companion-python.pythonCommand` (default: `python`)
  - CPython 実行コマンド
- `ac-companion-python.pypyCommand` (default: `pypy3`)
  - PyPy 実行コマンド
- `ac-companion-python.codonCommand` (default: `codon`)
  - Codon ビルドに使用するコマンド
- `ac-companion-python.codonBuildArgs` (default: `["build", "-release"]`)
  - Codon ビルド時に `main.py` の直前へ追加する引数（この拡張機能が自動で `-o <codonOutputName> main.py` を付与します）
- `ac-companion-python.codonOutputName` (default: `a.out`)
  - Codon ビルドで生成されるバイナリファイル名。Codon ではデフォルトで入力ファイル名（`main` など）が利用されるため、希望する名前にするには `-o` の指定が必要ですが、本拡張が自動で渡します。
- `ac-companion-python.runCwdMode` (default: `workspace`)
  - 実行時のカレントディレクトリ（`workspace` または `task`）
- `ac-companion-python.timeoutMs` (default: `null`)
  - 個別ケースのタイムアウト（ms）。未設定時は `timeLimit × 1.2` を自動採用
- `ac-companion-python.compare.mode` (default: `exact`)
  - 出力比較モード（現状 `exact`）
- `ac-companion-python.compare.caseSensitive` (default: `true`)
  - 出力比較の大小文字判定

## Notes

- インタラクティブ問題は未対応です
- 実行ログは Output パネル「AC Companion Python」にも出力されます
- ステータスバーに `ACCP: Running` が表示されている間は受信サーバーが起動中です

## Known Issues

現在のところ大きな既知の問題はありません。問題を見つけた場合は issue でご報告ください。

## Release Notes

### 1.1.3

- Codon ビルドコマンドの出力処理を改善。stdout を破棄し、stderr のみを収集して ANSI エスケープコードを除去するように変更

### 1.1.2

- Webview のテスト結果が途中で PENDING のまま残ることがあった問題を修正し、Run All の集計表示を正しく更新

### 1.1.1

- Codon ビルドが常に `-o <codonOutputName>` を指定するようになり、設定したバイナリ名がデフォルトで反映されるように修正

### 1.1.0

- Codon インタプリタの実行をサポート。`codon build -release -o <output> main.py` で 1 度だけビルドし、生成バイナリでサンプルを実行
- Webview のインタプリタ切替を `CPython → PyPy → Codon` の 3 段階に拡張し、ビルド時間を除いた実行時間を表示
- 設定に Codon コマンド／引数／出力ファイル名を追加

### 1.0.1

- テスト実行時に前回のテスト結果が残り、AC のはずが WA や古いスタックトレースが表示されることがある問題を修正

### 1.0.0

- サイドバー UI（ACCP Panel）を実装し、Run All／個別実行と結果表示（AC/WA/TLE/RE）に対応
- CPython / PyPy のインタプリタ切替を追加
- タイムアウト、自動比較（大小文字の判定切替）の設定を追加
- 既存テストがある場合は上書きせずスキップ（初回のみ自動保存）
- `main.py` を未存在時のみテンプレートからコピーし、エディタで自動オープン（`pass` を選択）

### 0.1.0

- テンプレートファイルの自動コピーとエディタ自動オープンを追加

### 0.0.1

- Competitive Companion から受信したテストケースの自動保存
- サーバー開始・停止コマンド、保存先/ポート設定を追加

## License

MIT
