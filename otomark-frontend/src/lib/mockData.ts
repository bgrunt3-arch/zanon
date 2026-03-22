/**
 * アーティストごとの最新SNS投稿（X/Twitter風）モックデータ
 * 推しの新曲を聴きながら、今の推しの言葉もチェックできる体験のため
 */

import type { ArtistSnsPost, SnsPlatform } from '@/lib/sns'

const MOCK_IMAGE_URL = '/icon.svg'

const MOCK_ARTIST_POSTS: Record<string, ArtistSnsPost> = {
  '6YVMFz59CuY7ngCxTxjpxE': {
    artistId: '6YVMFz59CuY7ngCxTxjpxE',
    artistName: 'aespa',
    handle: '@aespa_official',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'MYs ありがとう… 今日も一緒にいてくれて幸せだった 💜 次のステージでも会いましょう',
    postedAt: '2時間前',
    platform: 'x',
    url: 'https://x.com/aespa_official',
  },
  '2wY79sveU1sp5g7SokKOiI': {
    artistId: '2wY79sveU1sp5g7SokKOiI',
    artistName: 'NewJeans',
    handle: '@NewJeans_ADOR',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'Bunnies いつも応援してくれてありがとう 🐰 How Sweet 聴いてくれた？ みんなの反応が本当に嬉しい',
    postedAt: '5時間前',
    platform: 'x',
    url: 'https://x.com/NewJeans_ADOR',
  },
  '5J7V5xRGJ4F4D2f7QjB5x3': {
    artistId: '5J7V5xRGJ4F4D2f7QjB5x3',
    artistName: 'ILLIT',
    handle: '@ILLIT_official',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'LILLY たちの新しい一歩、見守ってくれてありがとう ✨ Magnetic のときの気持ち、届いてるといいな',
    postedAt: '1日前',
    platform: 'x',
    url: 'https://x.com/ILLIT_official',
  },
  '4gzpq5DPGxSnKTe4SA8HAU': {
    artistId: '4gzpq5DPGxSnKTe4SA8HAU',
    artistName: 'j-hope',
    handle: '@jhope',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'Hope on the street. 踊ることでしか伝えられないことがある。NEURON に込めた想い、感じてくれたら',
    postedAt: '3時間前',
    platform: 'x',
    url: 'https://x.com/jhope',
  },
  '6fWVd57NKTalqvmjRd2t8Z': {
    artistId: '6fWVd57NKTalqvmjRd2t8Z',
    artistName: 'りぶ',
    handle: '@rib_official',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'Rib Night 作ってるとき、ずっとこの瞬間を想像してた。聴いてくれてありがとう 🙏',
    postedAt: '6時間前',
    platform: 'x',
    url: 'https://x.com/rib_official',
  },
  '2M1Q3lY4n2h4L6x7u8v9w0': {
    artistId: '2M1Q3lY4n2h4L6x7u8v9w0',
    artistName: 'BOYNEXTDOOR',
    handle: '@BOYNEXTDOOR_',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'ONEDOOR のみんなへ。今日も一緒に音楽楽しもう 🚪✨',
    postedAt: '8時間前',
  },
  '1dfeR4HaWDbWqFHLkxsg1d': {
    artistId: '1dfeR4HaWDbWqFHLkxsg1d',
    artistName: 'Queen',
    handle: '@QueenWillRock',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'We will rock you. Forever. — Freddie',
    postedAt: '1日前',
  },
  '06HL4z0CvFAxyc27GXpf02': {
    artistId: '06HL4z0CvFAxyc27GXpf02',
    artistName: 'Taylor Swift',
    handle: '@taylorswift13',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'Swifties, you make every era magical. Thank you for being the best part of this journey 💛',
    postedAt: '4時間前',
  },
  '3TVXtAsR1Inumwj472S9r4': {
    artistId: '3TVXtAsR1Inumwj472S9r4',
    artistName: 'Drake',
    handle: '@Drake',
    avatarUrl: MOCK_IMAGE_URL,
    content: '6 God. OVO. One love to everyone riding with me.',
    postedAt: '12時間前',
  },
  '66CXWjxzNUsdJxJ2JdwvnR': {
    artistId: '66CXWjxzNUsdJxJ2JdwvnR',
    artistName: 'Ariana Grande',
    handle: '@ArianaGrande',
    avatarUrl: MOCK_IMAGE_URL,
    content: 'Thank u, next. And thank u, for always being there 💕',
    postedAt: '1日前',
  },
}

/**
 * アーティストIDに対応する最新SNS投稿を取得。なければ null
 */
export function getArtistLatestPost(artistId: string): ArtistSnsPost | null {
  return MOCK_ARTIST_POSTS[artistId] ?? null
}

/** 各アーティスト10件のベース投稿（X/Instagram/YouTube 混在、API上限100件/人に合わせて動的拡張） */
const MOCK_POSTS_BASE: Array<{ artistId: string; content: string; postedAt: string; platform: SnsPlatform }> = [
  // aespa (10件) - x, instagram, youtube 混在
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Armageddon リリースまであと少し… 楽しみにしてて 💜', postedAt: '30分前', platform: 'x' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'MYs ありがとう… 今日も一緒にいてくれて幸せだった 💜', postedAt: '2時間前', platform: 'instagram' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Supernova のライブ、最高だった！', postedAt: '4時間前', platform: 'x' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'MYs のみんな、今日もありがとう 💜', postedAt: '8時間前', platform: 'youtube' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'リハーサル中。本番が楽しみ', postedAt: '12時間前', platform: 'instagram' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: '新衣装のフィッティング 💜', postedAt: '1日前', platform: 'x' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Black Mamba からここまで、感謝', postedAt: '2日前', platform: 'youtube' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Next Level のときの気持ち、忘れない', postedAt: '3日前', platform: 'instagram' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Savage ツアー、また会おう', postedAt: '4日前', platform: 'x' },
  { artistId: '6YVMFz59CuY7ngCxTxjpxE', content: 'Drama の MV、見てくれた？', postedAt: '5日前', platform: 'youtube' },
  // NewJeans (10件)
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'NewJeans の新しい MV 撮影中 🐰', postedAt: '1時間前', platform: 'instagram' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Bunnies いつも応援してくれてありがとう 🐰', postedAt: '5時間前', platform: 'x' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Bunnies と過ごした時間、忘れない', postedAt: '4時間前', platform: 'youtube' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'How Sweet の振付、頑張って覚えてる', postedAt: '7時間前', platform: 'instagram' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: '今日の撮影、楽しかった 🐰', postedAt: '11時間前', platform: 'x' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Bunnies おやすみなさい', postedAt: '1日前', platform: 'youtube' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Attention から始まった旅', postedAt: '2日前', platform: 'youtube' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Hype Boy のダンス、覚えた？', postedAt: '3日前', platform: 'instagram' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'OMG の MV、また観てね', postedAt: '4日前', platform: 'x' },
  { artistId: '2wY79sveU1sp5g7SokKOiI', content: 'Ditto の季節、また来るね', postedAt: '5日前', platform: 'instagram' },
  // ILLIT (10件)
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'LILLY たちの新しい一歩、見守ってくれてありがとう ✨', postedAt: '1日前', platform: 'x' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'Magnetic のパフォーマンス、頑張る！', postedAt: '2時間前', platform: 'youtube' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'LILLY たち、今日も応援ありがとう', postedAt: '5時間前', platform: 'instagram' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: '新しいダンス、練習中 ✨', postedAt: '9時間前', platform: 'x' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'SUPER REAL ME 聴いてくれてありがとう', postedAt: '1日前', platform: 'youtube' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'デビューから1年、感謝', postedAt: '2日前', platform: 'instagram' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'Lucky Girl Syndrome のときの気持ち', postedAt: '3日前', platform: 'x' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'Magnetic の振付、難しいけど楽しい', postedAt: '4日前', platform: 'youtube' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: 'LILLY のみんな、ありがとう', postedAt: '5日前', platform: 'instagram' },
  { artistId: '5J7V5xRGJ4F4D2f7QjB5x3', content: '次のステージ、楽しみ', postedAt: '6日前', platform: 'x' },
  // j-hope (10件)
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'Hope on the street. NEURON に込めた想い、感じてくれたら', postedAt: '3時間前', platform: 'x' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'Hope World 2 の準備、進んでるよ', postedAt: '2時間前', platform: 'youtube' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'NEURON の振付、まだまだ磨く', postedAt: '5時間前', platform: 'instagram' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'Hope on the street、続けてる', postedAt: '10時間前', platform: 'x' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: '踊ることで伝わること、ある', postedAt: '1日前', platform: 'youtube' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'ARMY ありがとう', postedAt: '2日前', platform: 'instagram' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'Chicken Noodle Soup の思い出', postedAt: '3日前', platform: 'x' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'ダンスは言葉を超える', postedAt: '4日前', platform: 'youtube' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: 'Hope World から続く物語', postedAt: '5日前', platform: 'instagram' },
  { artistId: '4gzpq5DPGxSnKTe4SA8HAU', content: '次のステージ、準備中', postedAt: '6日前', platform: 'x' },
  // りぶ (10件)
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'Rib Night 作ってるとき、ずっとこの瞬間を想像してた 🙏', postedAt: '6時間前', platform: 'youtube' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'Rib Night のライブ、最高だった', postedAt: '3時間前', platform: 'x' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: '新曲、制作中 🙏', postedAt: '6時間前', platform: 'instagram' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: '聴いてくれてありがとう', postedAt: '10時間前', platform: 'youtube' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'Rib の世界観、届いてるといいな', postedAt: '1日前', platform: 'x' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: '次のリリース、お楽しみに', postedAt: '2日前', platform: 'instagram' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'ボカロの世界、広がってる', postedAt: '3日前', platform: 'youtube' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: '歌詞に込めた想い', postedAt: '4日前', platform: 'x' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'ライブで会える日を', postedAt: '5日前', platform: 'instagram' },
  { artistId: '6fWVd57NKTalqvmjRd2t8Z', content: 'Rib Night 続編、考えてる', postedAt: '6日前', platform: 'youtube' },
]

/** handle (@username) と platform からSNS投稿URLを生成 */
function buildPostUrl(handle: string, platform: SnsPlatform): string {
  const username = handle.replace(/^@/, '')
  switch (platform) {
    case 'x':
      return `https://x.com/${username}`
    case 'instagram':
      return `https://instagram.com/${username}`
    case 'youtube':
      return `https://youtube.com/@${username}`
    default:
      return `https://x.com/${username}`
  }
}

/** postedAt のオフセット用テンプレート（日数追加で重複回避） */
const POSTED_AT_OFFSETS = ['7日前', '8日前', '9日前', '10日前', '11日前', '12日前', '13日前', '14日前', '15日前', '16日前']

/** 直近のSNS投稿一覧（API上限: 5人×100件=500件。モックはベース10件/人を10倍に拡張） */
function buildMockPostsOrdered(): ArtistSnsPost[] {
  const out: ArtistSnsPost[] = []
  const byArtist = new Map<string, typeof MOCK_POSTS_BASE>()
  for (const b of MOCK_POSTS_BASE) {
    const arr = byArtist.get(b.artistId) ?? []
    arr.push(b)
    byArtist.set(b.artistId, arr)
  }
  for (const [, bases] of byArtist) {
    for (let r = 0; r < 10; r++) {
      for (const base of bases) {
        const artist = MOCK_ARTIST_POSTS[base.artistId]
        if (!artist) continue
        const postedAt = r === 0 ? base.postedAt : POSTED_AT_OFFSETS[r % POSTED_AT_OFFSETS.length]
        const platform = base.platform ?? 'x'
        const url = buildPostUrl(artist.handle, platform)
        out.push({ ...artist, content: base.content, postedAt, platform, url })
      }
    }
  }
  return out.slice(0, 500)
}

const MOCK_POSTS_ORDERED = buildMockPostsOrdered()

/** postedAt を分単位に変換（ソート用）。小さいほど新しい */
function postedAtToMinutes(postedAt: string): number {
  const m = postedAt.match(/^(\d+)(分|時間|日)前$/)
  if (!m) return 999999
  const n = Number(m[1])
  if (m[2] === '分') return n
  if (m[2] === '時間') return n * 60
  if (m[2] === '日') return n * 24 * 60
  return 999999
}

/** 未知アーティスト用の擬似投稿テンプレート */
const SYNTHETIC_TEMPLATES: Array<{ content: string; postedAt: string; platform: SnsPlatform }> = [
  { content: 'ファンのみんな、いつもありがとう。これからもよろしく。', postedAt: '1時間前', platform: 'x' },
  { content: '新しい音楽、準備中。楽しみにしていて。', postedAt: '3時間前', platform: 'x' },
  { content: 'ライブで会える日を楽しみにしている。', postedAt: '6時間前', platform: 'instagram' },
  { content: '聴いてくれてありがとう。', postedAt: '1日前', platform: 'x' },
  { content: '次のステージ、一緒に楽しもう。', postedAt: '2日前', platform: 'youtube' },
]

export function getRecentSnsPosts(
  artistIds: string[],
  limit: number,
  artistInfo?: Array<{ id: string; name: string }>,
): ArtistSnsPost[] {
  const idSet = new Set(artistIds)
  const infoMap = new Map(artistInfo?.map((a) => [a.id, a.name]) ?? [])

  const filtered = MOCK_POSTS_ORDERED.filter((p) => idSet.has(p.artistId))

  // 既存モックにないアーティスト向けの擬似投稿を追加
  for (const id of artistIds) {
    if (filtered.some((p) => p.artistId === id)) continue
    const name = infoMap.get(id) ?? 'Artist'
    const handle = `@${name.replace(/\s+/g, '_')}_official`
    for (let i = 0; i < SYNTHETIC_TEMPLATES.length; i++) {
      const t = SYNTHETIC_TEMPLATES[i]
      filtered.push({
        artistId: id,
        artistName: name,
        handle,
        avatarUrl: MOCK_IMAGE_URL,
        content: t.content,
        postedAt: t.postedAt,
        platform: t.platform,
        url: `https://x.com/${handle.replace('@', '')}`,
      })
    }
  }

  const sorted = [...filtered].sort((a, b) => postedAtToMinutes(a.postedAt) - postedAtToMinutes(b.postedAt))
  return sorted.slice(0, limit)
}
