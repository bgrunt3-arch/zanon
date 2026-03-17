-- =============================================
-- Otomark データベーススキーマ
-- =============================================

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(30)  UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  bio         TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- アーティストテーブル
CREATE TABLE IF NOT EXISTS artists (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  name_kana   VARCHAR(255),
  bio         TEXT,
  image_url   TEXT,
  country     VARCHAR(100),
  formed_year INT,
  genres      TEXT[],         -- {'J-POP', 'ロック'} など
  musicbrainz_id VARCHAR(36) UNIQUE,  -- 外部API連携用
  created_at  TIMESTAMP DEFAULT NOW()
);

-- アルバムテーブル
CREATE TABLE IF NOT EXISTS albums (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  artist_id   INT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  release_date DATE,
  cover_url   TEXT,
  genres      TEXT[],
  track_count INT,
  description TEXT,
  musicbrainz_id VARCHAR(36) UNIQUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 曲テーブル
CREATE TABLE IF NOT EXISTS tracks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  artist_id   INT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  album_id    INT REFERENCES albums(id) ON DELETE SET NULL,
  duration    INT,        -- 秒数
  track_number INT,
  musicbrainz_id VARCHAR(36) UNIQUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- マーク（聴いた記録）テーブル
-- album_id / track_id / artist_id のいずれか1つがセット
CREATE TABLE IF NOT EXISTS marks (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id    INT REFERENCES albums(id)  ON DELETE CASCADE,
  track_id    INT REFERENCES tracks(id)  ON DELETE CASCADE,
  artist_id   INT REFERENCES artists(id) ON DELETE CASCADE,
  score       SMALLINT CHECK (score BETWEEN 1 AND 5),
  listened_at TIMESTAMP DEFAULT NOW(),
  created_at  TIMESTAMP DEFAULT NOW(),
  -- 同一ユーザーが同一作品を複数回マークできないようにする
  UNIQUE (user_id, album_id),
  UNIQUE (user_id, track_id),
  UNIQUE (user_id, artist_id),
  -- いずれか1つのIDが必須
  CONSTRAINT one_target CHECK (
    (album_id IS NOT NULL)::int +
    (track_id IS NOT NULL)::int +
    (artist_id IS NOT NULL)::int = 1
  )
);

-- レビューテーブル
CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mark_id     INT NOT NULL REFERENCES marks(id) ON DELETE CASCADE UNIQUE,
  body        TEXT NOT NULL,
  spoiler     BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- いいねテーブル
CREATE TABLE IF NOT EXISTS review_likes (
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id  INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, review_id)
);

-- フォローテーブル
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ウォンツリスト（聴きたいリスト）
CREATE TABLE IF NOT EXISTS want_list (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id   INT REFERENCES albums(id) ON DELETE CASCADE,
  track_id   INT REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id  INT REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, album_id),
  UNIQUE (user_id, track_id),
  UNIQUE (user_id, artist_id),
  CONSTRAINT one_want_target CHECK (
    (album_id IS NOT NULL)::int +
    (track_id IS NOT NULL)::int +
    (artist_id IS NOT NULL)::int = 1
  )
);

-- 保存済みレビューテーブル
CREATE TABLE IF NOT EXISTS saved_reviews (
  user_id    INT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  review_id  INT NOT NULL REFERENCES reviews(id)  ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, review_id)
);

-- コメントテーブル
CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  review_id   INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- インデックス（パフォーマンス最適化）
-- =============================================
CREATE INDEX IF NOT EXISTS idx_marks_user_id       ON marks(user_id);
CREATE INDEX IF NOT EXISTS idx_marks_album_id      ON marks(album_id);
CREATE INDEX IF NOT EXISTS idx_reviews_mark_id     ON reviews(mark_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at  ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower    ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id    ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id     ON tracks(album_id);

-- =============================================
-- レビュー更新時に updated_at を自動更新するトリガー
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();