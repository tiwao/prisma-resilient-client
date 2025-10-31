# Development Guide

**作成日**: 2025年10月31日 11:07

## プロジェクト構成

```
prisma-resilient-client/
├── src/                          # ソースコード
│   ├── index.ts                  # メインエクスポート
│   ├── ResilientPrismaClient.ts  # コアクラス
│   ├── types.ts                  # 型定義
│   └── utils/                    # ユーティリティ関数
├── tests/                        # テストコード
│   ├── unit/                     # ユニットテスト
│   └── integration/              # 統合テスト
├── examples/                     # サンプルコード
│   ├── basic.ts                  # 基本的な使い方
│   ├── express.ts                # Express統合
│   └── monitoring.ts             # 監視統合
├── docs/                         # ドキュメント
│   ├── DEVELOPMENT.md            # このファイル
│   ├── API.md                    # API仕様書
│   └── MIGRATION.md              # 移行ガイド
├── dist/                         # ビルド出力（自動生成）
├── package.json                  # パッケージ設定
├── tsconfig.json                 # TypeScript設定
├── README.md                     # README
└── LICENSE                       # ライセンス
```

## セットアップ

### 1. 依存関係のインストール

```bash
cd /home/iwao/work/saito/prisma-resilient-client
npm install
```

### 2. 開発モードで起動

```bash
npm run dev
# TypeScriptが監視モードで起動し、変更を自動ビルド
```

### 3. ビルド

```bash
npm run build
# dist/ ディレクトリに出力
```

## 開発フロー

### 実装の優先順位

#### Phase 1: コア機能（1-2日）
- [x] プロジェクト構造の作成
- [ ] ResilientPrismaClient の基本実装
  - [ ] 接続管理
  - [ ] 自動再接続ロジック
  - [ ] executeWithReconnect ラッパー
- [ ] 基本的な型定義

#### Phase 2: 拡張機能（1日）
- [ ] イベントシステム
- [ ] ヘルスチェック
- [ ] メモリ管理
- [ ] 定期リフレッシュ

#### Phase 3: テスト（1日）
- [ ] ユニットテスト
- [ ] 統合テスト
- [ ] エッジケーステスト

#### Phase 4: ドキュメント・公開（0.5日）
- [ ] API ドキュメント
- [ ] サンプルコード
- [ ] README 完成
- [ ] npm 公開

## 実装のポイント

### 元のコードからの移植

元プロジェクト (`saito_face_interview`) の以下を参考にする:

**DatabaseService.ts の ensureConnected()**:
```typescript
// 場所: video_analyzer_web/backend/src/services/DatabaseService.ts:45-78
private async ensureConnected(): Promise<void> {
  // この実装をそのまま使える
}
```

**executeWithReconnect()**:
```typescript
// 場所: video_analyzer_web/backend/src/services/DatabaseService.ts:80-169
private async executeWithReconnect<T>(...): Promise<T> {
  // この実装が核心部分
}
```

### PrismaClient のプロキシ化

Prismaの全メソッドを自動でラップする必要がある:

```typescript
// 悪い例（手動で30個以上のメソッドをラップ）
async createUser(data) {
  return this.executeWithReconnect(async () => {
    return await this.prisma.user.create({ data });
  });
}

// 良い例（Proxyで自動ラップ）
private proxyPrismaMethods() {
  const models = Object.keys(this.prisma).filter(
    key => typeof (this.prisma as any)[key] === 'object'
  );

  for (const model of models) {
    (this as any)[model] = new Proxy((this.prisma as any)[model], {
      get: (target, prop) => {
        const original = target[prop];
        if (typeof original === 'function') {
          return async (...args: any[]) => {
            return this.executeWithReconnect(async () => {
              return await original.apply(target, args);
            }, `${model}.${String(prop)}`);
          };
        }
        return original;
      },
    });
  }
}
```

## テスト戦略

### ユニットテスト

```typescript
// tests/unit/ResilientPrismaClient.test.ts
describe('ResilientPrismaClient', () => {
  it('should reconnect on connection error', async () => {
    // モックで接続エラーを発生させる
    // 自動再接続を確認
  });

  it('should respect maxAttempts', async () => {
    // 3回失敗後にエラーをthrow
  });

  it('should calculate exponential backoff correctly', () => {
    // バックオフ計算のテスト
  });
});
```

### 統合テスト

```typescript
// tests/integration/realDatabase.test.ts
describe('ResilientPrismaClient with real database', () => {
  it('should handle connection drops', async () => {
    // 実際のPostgreSQLに接続
    // 接続を強制切断
    // 再接続を確認
  });
});
```

## デバッグ

### ログレベルの設定

```typescript
const prisma = new ResilientPrismaClient({
  resilient: {
    logging: {
      level: 'debug',  // 詳細ログを出力
    },
  },
});
```

### イベントリスナーでデバッグ

```typescript
prisma.on('reconnect', (attempt) => {
  console.log(`[DEBUG] Reconnect attempt: ${attempt}`);
});

prisma.on('disconnect', (error) => {
  console.error(`[DEBUG] Disconnected:`, error);
});
```

## パフォーマンス最適化

### メモリ使用量の監視

```typescript
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Heap:', (usage.heapUsed / 1024 / 1024).toFixed(2), 'MB');
}, 10000);
```

### クエリ実行時間の計測

```typescript
// executeWithReconnect 内で自動計測済み
// ログレベル 'debug' で確認可能
```

## リリース手順

### 1. バージョンアップ

```bash
# patch: 0.1.0 → 0.1.1
npm version patch

# minor: 0.1.0 → 0.2.0
npm version minor

# major: 0.1.0 → 1.0.0
npm version major
```

### 2. ビルドとテスト

```bash
npm run build
npm test
```

### 3. npm公開

```bash
npm login
npm publish

# 初回公開時
npm publish --access public
```

### 4. Gitタグ作成

```bash
git tag v0.1.0
git push origin v0.1.0
```

## トラブルシューティング

### ビルドエラー

```bash
# node_modules と dist を削除して再ビルド
rm -rf node_modules dist
npm install
npm run build
```

### テスト失敗

```bash
# 詳細ログでテスト実行
npm test -- --verbose
```

### 型エラー

```bash
# Prisma Client の型を再生成
npx prisma generate
```

## コントリビューション

### Pull Request の流れ

1. Issue を作成
2. ブランチを作成: `git checkout -b feature/xxx`
3. 変更をコミット
4. テストを実行: `npm test`
5. Pull Request を作成

### コードスタイル

- TypeScript strict モード
- ESLint ルールに従う
- Prettier でフォーマット

```bash
npm run lint    # リント
npm run format  # フォーマット
```

## 参考リンク

- [元プロジェクト (saito_face_interview)](../saito_face_interview)
- [Prisma Documentation](https://www.prisma.io/docs)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

---

**次のステップ**: `src/ResilientPrismaClient.ts` の実装を開始
