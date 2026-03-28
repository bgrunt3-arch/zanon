# Orbit 🪐

**推しアーティスト5人のYouTube最新動画をひとつの画面に。Spotifyで即再生。**

[![Production](https://img.shields.io/badge/deploy-vercel-black?style=flat-square&logo=vercel)](https://zanon-nine.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-backend-orange?style=flat-square)](https://hono.dev/)

🔗 **Live:** https://zanon-nine.vercel.app/

---

![mockup](https://raw.githubusercontent.com/bgrunt3-arch/zanon/main/orbit-mockup-3screens.png)

---

## 概要

複数のアーティストを追うファンが抱える「YouTubeの通知が埋もれて見逃す」問題を解決するWebアプリ。

推しを最大5人登録すると、各チャンネルの最新動画がひとつのフィードに集約される。Spotify連携で気になった曲はそのまま再生できる。

---

## 技術スタック

### フロントエンド (otomark-frontend)

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 14（App Router） |
| 言語 | TypeScript |
| スタイリング | CSS Modules |
| 状態管理 | React Context + useRef |
| 認証 | Spotify OAuth PKCE（独自実装） |

### バックエンド (otomark-backend)

| 項目 | 技術 |
|------|------|
| フレームワーク | Hono |
| 言語 | TypeScript |
| DB | SQLite（better-sqlite3） |
| 認証 | JWT |
| ランタイム | Node.js |

### 外部API

| API | 用途 |
|-----|------|
| Spotify Web API | アーティスト・アルバム・トラック情報 |
| Spotify Web Playback SDK | Premiumユーザー向けフル再生 |
| YouTube RSS | 最新動画フィード（APIクォータ不使用） |
| MusicBrainz API | アーティストのSNS URL取得 |
| Last.fm API | アーティスト関連情報 |

---

## 設計のこだわり

### YouTube RSS でクォータゼロ
YouTube Data API は1日あたりのクォータ制限が厳しい。動画フィードの取得に RSS を使うことで、ユーザー数が増えてもAPIクォータを一切消費しない設計にした。

### Spotify PKCE を独自実装
ライブラリに頼らず OAuth PKCEフローをスクラッチ実装。認証の仕組みを深く理解した上でカスタマイズ性の高い設計を実現した。

### フロント・バックの分離構成
otomark-frontend（Vercel）と otomark-backend（Hono）を分離し、将来的なスケールアップや機能追加に対応しやすい構成にした。

---

## ロードマップ

- [x] YouTube連携
- [x] Spotify連携（再生・検索）
- [x] アーティストフィード
- [ ] X（Twitter）API連携（資金調達後）
- [ ] PWA対応
- [ ] 通知機能

---

## ディレクトリ構成

zanon/
├── otomark-frontend/   # Next.js 14 App Router
└── otomark-backend/    # Hono + SQLite

---

## 開発者

**Irodori** — 個人開発者

- X: @plqol7 https://x.com/plqol7
- note: https://note.com/plqol7/n/n8d668330f60a
- GitHub: @bgrunt3-arch https://github.com/bgrunt3-arch
