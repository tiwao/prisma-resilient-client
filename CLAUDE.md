# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Prisma Resilient Clientは、Prisma ORMに自動再接続機能と本番環境向けの堅牢な接続管理機能を追加するパッケージです。`saito_face_interview`プロジェクトで発生した長時間稼働時の接続切断問題(11時間後に`Error: Engine is not yet connected.`)を解決するために開発されました。

**目的**: 1000行以上のボイラープレートコードを数行の設定で置き換え、PrismaClientのドロップイン置き換えとして機能する汎用パッケージを提供。

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発モード（TypeScript監視モード）
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# テスト（監視モード）
npm test:watch

# リント
npm run lint

# フォーマット
npm run format

# npm公開前の準備（ビルド + テスト）
npm run prepublishOnly
```

## プロジェクト構造

```
src/
├── index.ts                  # メインエクスポート（未実装）
├── ResilientPrismaClient.ts  # コアクラス（未実装）
├── types.ts                  # 型定義（実装済み）
└── utils/                    # ユーティリティ関数（未実装）

tests/                        # テストディレクトリ（空）
examples/                     # サンプルコード（空）
docs/
└── DEVELOPMENT.md           # 開発ガイド
```

## アーキテクチャの要点

### 1. 自動再接続メカニズム

コアとなる`executeWithReconnect`メソッドは、元プロジェクト(`saito_face_interview/video_analyzer_web/backend/src/services/DatabaseService.ts:80-169`)の実装を移植する必要があります。

**主要な処理フロー**:
1. クエリ失敗 → 接続エラー検出(P1001, P1008等)
2. バックオフ戦略で再接続試行(最大3回)
3. 接続成功後に元の操作をリトライ
4. 成功 or 最大試行回数後にthrow

### 2. Proxyベースのメソッドラッピング

手動で30個以上のメソッドをラップする代わりに、JavaScript Proxyを使用してPrismaClientの全メソッドを自動的にラップします。

**重要**: `src/types.ts`に定義されているインターフェースに基づき、以下の機能を実装:
- `ResilientConfig`: 再接続、リフレッシュ、メモリ管理、ヘルスチェック、ログ設定
- `ConnectionStats`: 接続統計情報
- `HealthCheckResult`: ヘルスチェック結果
- `ResilientPrismaEvents`: イベントシステム

### 3. 接続管理とライフサイクル

- **定期リフレッシュ**: デフォルト5分間隔で接続をリフレッシュ
- **ヘルスチェック**: データベース接続状態とレイテンシを確認
- **メモリ管理**: ヒープ使用率85%でGC実行
- **イベントシステム**: connect, disconnect, reconnect, memory:high等のイベント発行

## 開発上の重要な注意点

### 元プロジェクトからの移植

元の`DatabaseService.ts`から以下のメソッドを参考にすること:
- `ensureConnected()`: 45-78行 - 接続確立ロジック
- `executeWithReconnect()`: 80-169行 - 再接続とリトライロジックの核心

### Prismaのエラーコード

以下のエラーコードを接続エラーとして扱う:
- P1001: サーバーに到達できない
- P1008: タイムアウト
- P1017: サーバー切断
- その他、メッセージに"connection"を含むエラー

### TypeScript設定

- **Strict mode**: 有効
- **Target**: ES2020
- **Module**: CommonJS
- **Declaration**: true（型定義ファイル生成）

### テスト戦略

1. **ユニットテスト**: モックを使用した再接続ロジックの検証
2. **統合テスト**: 実際のデータベースを使用した接続切断・再接続の検証

## 実装状況

**Phase 1: MVP開発（✅ 完了）**
- [x] プロジェクト構造作成
- [x] 型定義実装(`src/types.ts`)
- [x] ResilientPrismaClient クラス実装
- [x] 自動再接続ロジック実装
- [x] Proxyによるメソッドラップ実装
- [x] 定期リフレッシュ機能
- [x] ヘルスチェック機能
- [x] メモリ管理機能
- [x] イベントシステム

**現在のバージョン**: v0.1.1 (2025-10-31)

**最近のバグ修正 (v0.1.1)**:
- 定期リフレッシュの堅牢性向上
  - `src/ResilientPrismaClient.ts:147`: disconnect失敗時も`connected`フラグを確実にfalseに設定
  - `src/ResilientPrismaClient.ts:277-283`: リフレッシュ処理で`ensureConnected()`を使用して再接続のリトライロジックを活用
  - `src/ResilientPrismaClient.ts:288`: リフレッシュ失敗時も`connected`フラグをfalseに設定し、次回操作時の再接続を保証

## グローバル指示との連携

このプロジェクトでは、`~/.claude/CLAUDE.md`のグローバル指示に従い:
- 実装前にユーザーの許可を得ること
- 作業記録を日付・時刻付きでプロジェクトディレクトリに保存
- git commit前にREADME.md、CLAUDE.md、関連文書を更新
