CREATE TABLE waitlist (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL,
  management_hash TEXT NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
