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

-- レビュー機能廃止に伴う旧テーブル削除
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS saved_reviews CASCADE;
DROP TABLE IF EXISTS review_likes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;


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


-- 通知テーブル
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('follow')),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);
ALTER TABLE notifications DROP COLUMN IF EXISTS review_id;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN ('follow'));
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- =============================================
-- インデックス（パフォーマンス最適化）
-- =============================================
CREATE INDEX IF NOT EXISTS idx_marks_user_id       ON marks(user_id);
CREATE INDEX IF NOT EXISTS idx_marks_album_id      ON marks(album_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower    ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id    ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id     ON tracks(album_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- MusicBrainz キャッシュテーブル
-- =============================================
CREATE TABLE IF NOT EXISTS music_cache (
  mbid            VARCHAR(36)  PRIMARY KEY,
  entity_type     VARCHAR(20)  NOT NULL CHECK (entity_type IN ('artist', 'release', 'release-group', 'recording')),
  name            VARCHAR(255) NOT NULL,
  image_url       TEXT,
  data            JSONB,
  last_fetched_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_music_cache_entity_type ON music_cache(entity_type);

-- =============================================
-- ユーザーブックマークテーブル
-- =============================================
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id         SERIAL    PRIMARY KEY,
  user_id    INT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mbid       VARCHAR(36) NOT NULL REFERENCES music_cache(mbid) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mbid)
);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks(user_id);

-- =============================================
-- ユーザーお気に入りアーティスト（最大5件）
-- =============================================
CREATE TABLE IF NOT EXISTS user_faves (
  id                 SERIAL PRIMARY KEY,
  user_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id          VARCHAR(100) NOT NULL,
  artist_name        VARCHAR(255) NOT NULL,
  artist_image_url   TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_user_faves_user_id ON user_faves(user_id);

-- 既存環境との互換: 旧カラム名から新カラム名へ移行
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_faves' AND column_name = 'spotify_artist_id'
  ) THEN
    ALTER TABLE user_faves RENAME COLUMN spotify_artist_id TO artist_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_faves' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE user_faves RENAME COLUMN image_url TO artist_image_url;
  END IF;
END;
$$;

-- 1ユーザー最大5件のDB制約
CREATE OR REPLACE FUNCTION enforce_user_faves_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM user_faves
    WHERE user_id = NEW.user_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
  ) >= 5 THEN
    RAISE EXCEPTION 'user_faves limit exceeded (max 5 per user)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_faves_limit_trigger ON user_faves;
CREATE TRIGGER user_faves_limit_trigger
  BEFORE INSERT OR UPDATE OF user_id ON user_faves
  FOR EACH ROW
  EXECUTE FUNCTION enforce_user_faves_limit();