CREATE TABLE IF NOT EXISTS album_users (
  id VARCHAR(36) PRIMARY KEY,
  wechat_openid VARCHAR(128) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES album_users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE IF NOT EXISTS album_entries (
  user_id VARCHAR(36) NOT NULL REFERENCES album_users(id),
  level_id INT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (user_id, level_id)
);

ALTER TABLE album_entries ADD CONSTRAINT IF NOT EXISTS album_catalog_range CHECK (level_id BETWEEN 1 AND 12);
