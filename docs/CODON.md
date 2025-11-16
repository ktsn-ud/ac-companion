# Codon サポート設計メモ

本ドキュメントは、AC Companion Python に Codon を追加対応する際の仕様と実装方針をまとめたものです。  
実装前の設計資料として扱い、コード変更時は本ファイルを更新します。

## ゴール・前提

- Dev Container 環境を前提に、`codon` コマンドが利用可能であること。
- 各問題（`contestId/taskId`）について:
  - `codon build -release main.py` を **1 回だけ** 実行してネイティブバイナリ（`a.out`）を作成。
  - 作成した `a.out` を使って、サンプルテストケースを順次実行する。
- タイムアウト判定・時間表示は、**ビルド時間を含めず、実行時間のみ** を対象とする。

## 設定項目の拡張

`docs/CONFIG.md` および `package.json` の `contributes.configuration` と整合する形で、以下を追加する。

- `ac-companion-python.interpreter`
  - type: string enum: `["cpython", "pypy", "codon"]`
  - default: `"cpython"`
  - 既存の CPython / PyPy に加え、Codon を選択可能にする。

- `ac-companion-python.codonCommand`
  - type: string
  - default: `"codon"`
  - Description: Codon 実行コマンド（devcontainer 内で `codon` が PATH に通っている前提）。

- `ac-companion-python.codonBuildArgs`（実装する場合）
  - type: string[]
  - default: `["build", "-release"]`
  - Description: Codon ビルド時に渡す追加引数。既定では `codon build -release main.py` 相当を実行する。

- `ac-companion-python.codonOutputName`（実装する場合）
  - type: string
  - default: `"a.out"`
  - Description: Codon ビルドで生成される出力バイナリ名。`contestId/taskId` ディレクトリ直下に作成する。

既存の `timeoutMs`、`runCwdMode` などはそのまま再利用する。

## ビルドと実行の流れ

### 共通の前提

- ソリューションファイルは従来どおり `/<contestId>/<taskId>/main.py`。
- テストケースは `/<contestId>/<taskId>/<testsDir>/1.in`, `1.out`, ...。
- `runCwdMode` の値にかかわらず、**Codon のビルド先ディレクトリ** は問題ごとに固定する:
  - `solutionDir = /<workspaceRoot>/<contestId>/<taskId>`
  - `binaryPath = path.join(solutionDir, codonOutputName)`（既定 `a.out`）

### Codon ビルド処理

（実装イメージ。実際の関数名は実装時に調整）

- `buildCodonBinary(problem, settings, workspaceRoot): Promise<string>`
  - `solutionPath = path.join(solutionDir, "main.py")`
  - コマンド:  
    - ベース: `settings.codonCommand`（既定 `"codon"`）  
    - 引数: `settings.codonBuildArgs ?? ["build", "-release"]`  
    - 最終的に `codon build -release main.py` を `cwd = solutionDir` で実行するイメージ。
  - 成功時:
    - `binaryPath`（例: `/<workspaceRoot>/<contestId>/<taskId>/a.out`）が存在する前提で、そのパスを返す。
  - 失敗時:
    - `stderr` をまとめて `Error` として投げる（上位で RE あるいは通知として扱う）。
  - タイムアウト:
    - ビルド用タイムアウトを導入する場合は、`timeoutMs` とは別に扱う（詳細は実装時に決定）。
    - 重要なのは、**ビルド時間はテストケースのタイムアウト判定や表示に含めない** こと。

### テストケース実行（Codon）

- Codon 用の実行関数（例: `runCodonTestCase(binaryPath, ...)`）を用意する。
- 既存の Python 実行と同様に:
  - `spawn(binaryPath, [], { cwd, env })` で子プロセスを起動。
  - stdin に `.in` の内容を流し、stdout/stderr をバッファリング。
  - `normalizeLineEndings` や `compareOutputs` など、既存の比較ロジックを再利用する。
  - `RunStatus` は `AC` / `WA` / `TLE` / `RE` を既存と同じルールで判定。

## タイムアウトと時間計測（重要仕様）

ユーザー要望により、**ビルド時間を除いた実実行時間のみを測定** する。

### 個別ケースの `durationMs`

- 現行仕様:
  - `runTestCase()` 内で `startAt = Date.now()` を取り、子プロセス終了までの経過時間を `durationMs` として保持。
  - `timeoutMs` はこの実行時間に対してのみ適用される。
- Codon 対応後もこの仕様を維持する:
  - `runCodonTestCase()` 内で `startAt = Date.now()` を取り、`spawn(a.out)` 〜 終了までのみを計測。
  - `buildCodonBinary()` の所要時間は **一切 `durationMs` に含めない**。
  - TLE 判定も同様に、実行時間だけに基づいて行う。

### 全テスト実行時の合計時間

- 現状、`handleRunAllTests()` では以下のような流れで集計している:
  - `const startAt = Date.now();`
  - 各テストケースをループで実行し、最後に `sendRunComplete("all", results, Date.now() - startAt);`
  - Webview ではこれを `"X/Y passed (ZZZms)"` の `ZZZms` として表示。
- Codon の場合の扱い:
  - `runAll` フローを以下のように分岐させる:
    1. `interpreter === "codon"` のとき:
       - まず `buildCodonBinary()` を実行する（この間は **まだ** 計測開始しない）。
       - ビルドが成功したら、ここで初めて `runStartAt = Date.now()` を取る。
       - その後、全テストケースを `runCodonTestCase()` で順次実行する。
       - `sendRunComplete()` には `Date.now() - runStartAt` を渡し、  
         「ビルドを除いた合計実行時間」を UI に表示する。
    2. `interpreter !== "codon"`（CPython/PyPy）のとき:
       - 既存どおり、`startAt` をテストループの直前で取る（ビルドフェーズが存在しないため）。

### 単一テスト実行時の扱い

- `runSingleTestByIndex()`（および Webview からの `ui/runOne`）も Codon に対応する。
- Codon の場合の基本方針:
  - **単一テスト実行時は、`a.out` が既に存在していても必ず再ビルドする。**
    - `buildCodonBinary()` を毎回呼び出し、成功したら `runCodonTestCase()` を実行する。
    - これにより、「編集後に単一ケースだけ再確認したい」ケースでも、ソースとバイナリの不整合を避けられる。
- このときも:
  - ビルド前後で計測を分け、`durationMs` は **Codon 実行の時間のみ** とする。
  - ビルドに失敗した場合は、テストケース実行に進まず、エラー通知（Output チャネルと Webview）を行う。

## Dev Container での利用前提

- Dev Container 内で `codon` が利用可能な状態にする（Dockerfile 等で事前インストール）。
- 典型的な利用イメージ:
  - `ac-companion-python.interpreter = "codon"`
  - `ac-companion-python.codonCommand = "codon"`
  - 問題取得後、`Run All Tests` を実行すると:
    1. `codon build -release main.py` が `contestId/taskId` ディレクトリで 1 回だけ実行される。
    2. 生成された `a.out` で各 `.in` を実行し、`durationMs` は実行のみを計測。

## UI / Webview への影響

- Interpreter 選択:
  - 既存の CPython / PyPy トグルを拡張し、`"cpython"`, `"pypy"`, `"codon"` の 3 状態を切り替え可能にする。
  - 例: `CPython -> PyPy -> Codon -> CPython` のような循環。
- 表示テキスト:
  - Header に表示する Interpreter 情報に Codon を追加。
  - Timeout 表示は Python と同様に `timeoutMs` または `timeLimit × 1.2` を利用（Codon でも同じ値を用いる）。
- 実行時間表示:
  - Webview の `run/complete` メッセージに含まれる `durationMs` は、  
    Codon の場合も「ビルド時間を除いた合計実行時間」であることを前提にする。

## まとめ

- Codon 対応では、**ビルドとテスト実行を明確に分離** し、ビルドは 1 問につき 1 回だけ行う。
- タイムアウト判定および時間表示は、**ビルド時間を除外した実実行時間のみ** を対象とする。
- Dev Container では `codon build -release main.py` → `a.out` → テスト実行という流れを標準とする。
- この仕様を元に、`src/types/config.ts`／`src/core/testRunner.ts`／`src/extension.ts`／Webview 関連の型・UI を順次拡張していく。
