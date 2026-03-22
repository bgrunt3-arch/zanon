# 画面サイズに合わせたスケーリング設計

すべての表示を画面サイズに合わせて拡大縮小し、画面全体のバランスを保つ設計。`clamp()` と viewport 単位（vw）で滑らかに調整する。

## デザイントークン（globals.css）

| 変数 | 用途 |
|------|------|
| `--spacing-*` | 余白（xs〜2xl） |
| `--font-*` | フォントサイズ（xs〜2xl） |
| `--radius-*` | 角丸（sm〜xl） |
| `--gap-*` | ギャップ（sm〜lg） |
| `--icon-sm/md/lg` | アイコンサイズ |
| `--avatar-sm/md/lg` | アバターサイズ |

## 使い方

```css
/* 固定値の代わりにトークンを使用 */
.myComponent {
  padding: var(--spacing-lg);
  font-size: var(--font-md);
  border-radius: var(--radius-md);
  gap: var(--gap-md);
}

/* 独自の fluid 値が必要な場合 */
.myComponent {
  width: clamp(280px, 90vw, 600px);
  min-height: clamp(80px, 20vw, 120px);
}
```

## レイアウトの原則

- **viewport 単位** (`vw`, `vh`) でスケール
- **min() / max()** で境界を制御
- **env(safe-area-inset-*)** でノッチやホームインジケータ対応
- ブレークポイントはレイアウトの大きな変更（例: モバイル↔タブレット）のみに使用
