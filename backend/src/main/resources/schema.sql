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
  level_id INT NOT NULL CHECK (level_id BETWEEN 1 AND 10),
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (user_id, level_id)
);
