const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL. HoneyCord production mode requires shared PostgreSQL state.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: String(process.env.DATABASE_SSL || 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id text PRIMARY KEY,
      enabled boolean NOT NULL DEFAULT true,
      honeypot_channel_id text,
      log_channel_id text,
      trigger_count bigint NOT NULL DEFAULT 0,
      last_trigger_at timestamptz,
      action text NOT NULL DEFAULT 'softban',
      delete_seconds integer NOT NULL DEFAULT 3600,
      panel_text text
    );
    ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'softban';
    ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS delete_seconds integer NOT NULL DEFAULT 3600;
    ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS panel_text text;
    CREATE TABLE IF NOT EXISTS trigger_events (
      id bigserial PRIMARY KEY,
      guild_id text NOT NULL,
      user_id text NOT NULL,
      channel_id text NOT NULL,
      message_id text,
      action text NOT NULL,
      dry_run boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS trigger_events_guild_created_idx
      ON trigger_events (guild_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS honeypot_channels (
      guild_id text NOT NULL,
      channel_id text NOT NULL,
      channel_name text NOT NULL,
      trigger_count bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (guild_id, channel_id)
    );
    CREATE INDEX IF NOT EXISTS honeypot_channels_channel_idx
      ON honeypot_channels (channel_id);
  `);
}

async function getHoneypotChannels(guildId) {
  const result = await pool.query(
    `SELECT guild_id, channel_id, channel_name, trigger_count
     FROM honeypot_channels WHERE guild_id = $1 ORDER BY created_at, channel_name`, [guildId],
  );
  return result.rows;
}

async function upsertHoneypotChannel(guildId, channelId, channelName) {
  const result = await pool.query(
    `INSERT INTO honeypot_channels (guild_id, channel_id, channel_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, channel_id) DO UPDATE SET channel_name = $3
     RETURNING guild_id, channel_id, channel_name, trigger_count`,
    [guildId, channelId, channelName],
  );
  return result.rows[0];
}

async function getGuildConfig(guildId) {
  const result = await pool.query(
    `INSERT INTO guild_configs (guild_id) VALUES ($1)
     ON CONFLICT (guild_id) DO NOTHING
     RETURNING guild_id, enabled, honeypot_channel_id, log_channel_id, trigger_count, last_trigger_at, action, delete_seconds, panel_text`,
    [guildId],
  );
  if (result.rows[0]) return result.rows[0];
  const existing = await pool.query(
    `SELECT guild_id, enabled, honeypot_channel_id, log_channel_id, trigger_count, last_trigger_at, action, delete_seconds, panel_text
     FROM guild_configs WHERE guild_id = $1`, [guildId],
  );
  return existing.rows[0];
}

async function setGuildChannels(guildId, honeypotChannelId) {
  const result = await pool.query(
    `INSERT INTO guild_configs (guild_id, honeypot_channel_id, log_channel_id)
     VALUES ($1, $2, NULL)
     ON CONFLICT (guild_id) DO UPDATE SET honeypot_channel_id = $2, log_channel_id = NULL
     RETURNING guild_id, enabled, honeypot_channel_id, log_channel_id, trigger_count, last_trigger_at, action, delete_seconds, panel_text`,
    [guildId, honeypotChannelId],
  );
  return result.rows[0];
}

async function setEnabled(guildId, enabled) {
  await pool.query(
    `INSERT INTO guild_configs (guild_id, enabled) VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET enabled = $2`, [guildId, enabled],
  );
}

async function setPanelText(guildId, panelText) {
  const result = await pool.query(
    `INSERT INTO guild_configs (guild_id, panel_text) VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET panel_text = $2
     RETURNING guild_id, enabled, honeypot_channel_id, log_channel_id, trigger_count, last_trigger_at, action, delete_seconds, panel_text`,
    [guildId, panelText || null],
  );
  return result.rows[0];
}

async function setSettings(guildId, action) {
  await pool.query(
    `INSERT INTO guild_configs (guild_id, action) VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET action = $2`, [guildId, action],
  );
}

async function recordTrigger({ guildId, userId, channelId, messageId, action, dryRun }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO guild_configs (guild_id, trigger_count, last_trigger_at)
       VALUES ($1, 1, now())
       ON CONFLICT (guild_id) DO UPDATE SET trigger_count = guild_configs.trigger_count + 1, last_trigger_at = now()`,
      [guildId],
    );
    await client.query(
      `UPDATE honeypot_channels SET trigger_count = trigger_count + 1
       WHERE guild_id = $1 AND channel_id = $2`, [guildId, channelId],
    );
    await client.query(
      `INSERT INTO trigger_events (guild_id, user_id, channel_id, message_id, action, dry_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [guildId, userId, channelId, messageId, action, dryRun],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getGlobalStats() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS servers, COALESCE(SUM(trigger_count), 0)::bigint AS triggers FROM guild_configs`,
  );
  return result.rows[0];
}

async function getServerStats(guildId) {
  const summary = await pool.query(
    `SELECT COUNT(*)::int AS total_events,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7d,
            COUNT(*) FILTER (WHERE dry_run = true)::int AS dry_run_events,
            MAX(created_at) AS last_event_at
     FROM trigger_events WHERE guild_id = $1`, [guildId],
  );
  const channels = await pool.query(
    `SELECT channel_id, channel_name, trigger_count FROM honeypot_channels
     WHERE guild_id = $1 ORDER BY trigger_count DESC, channel_name`, [guildId],
  );
  const actions = await pool.query(
    `SELECT action, COUNT(*)::int AS count FROM trigger_events
     WHERE guild_id = $1 GROUP BY action ORDER BY count DESC`, [guildId],
  );
  return { summary: summary.rows[0], channels: channels.rows, actions: actions.rows };
}

async function closeDb() { await pool.end(); }

module.exports = { ensureSchema, getGuildConfig, getHoneypotChannels, upsertHoneypotChannel, setGuildChannels, setEnabled, setPanelText, setSettings, recordTrigger, getGlobalStats, getServerStats, closeDb };
