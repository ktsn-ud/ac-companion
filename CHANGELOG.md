# Change Log

All notable changes to the "ac-companion-python" extension are documented here. This file mirrors the Release Notes section in `README.md`.

## [1.1.3]

### Changed

- Codon ビルドコマンドの出力処理を改善。stdout を破棄し、stderr のみを収集して ANSI エスケープコードを除去するように変更（`codon build --release -o a.out Main.py 2>&1 > /dev/null | ansifilter 1>&2` 相当）

## [1.1.2]

### Fixed

- Run All 実行時に Webview の各テスト結果が途中で PENDING のままになることがある問題を修正し、総合結果表示も正しく更新されるように改善

## [1.1.1]

### Fixed

- Codon ビルドが常に `-o <codonOutputName>` を指定するようになり、設定したバイナリ名がデフォルトで反映されるように修正

## [1.1.0]

### Added

- Codon インタプリタの実行をサポート。`codon build -release -o <output> main.py` で 1 度だけビルドし、生成バイナリでサンプルを実行
- Webview のインタプリタ切替を `CPython → PyPy → Codon` の 3 段階に拡張し、ビルド時間を除いた実行時間を表示
- 設定に Codon コマンド／引数／出力ファイル名を追加

## [1.0.1]

### Fixed

- テスト実行時に前回のテスト結果が残り、AC のはずが WA や古いスタックトレースが表示されることがある問題を修正

## [1.0.0]

### Added

- サイドバー UI（ACCP Panel）を実装し、Run All／個別実行と結果表示（AC/WA/TLE/RE）に対応
- CPython / PyPy のインタプリタ切替を追加
- タイムアウト、自動比較（大小文字の判定切替）の設定を追加
- 既存テストがある場合は上書きせずスキップ（初回のみ自動保存）
- `main.py` を未存在時のみテンプレートからコピーし、エディタで自動オープン（`pass` を選択）

## [0.1.0]

### Added

- テンプレートファイルの自動コピーとエディタ自動オープンを追加

## [0.0.1]

### Added

- Competitive Companion から受信したテストケースの自動保存
- サーバー開始・停止コマンド、保存先/ポート設定を追加
