# HoneyCord

> A fast, English Discord honeypot bot built for real communities.

HoneyCord creates a dedicated honeypot channel when it joins a server. The channel contains a short Components V2 warning with HoneyCord branding and a clickable `Kicks` button. Messages sent there are treated as suspicious activity and can trigger a kick, ban, or softban.

## Highlights

- Discord auto-sharding for large multi-server deployments
- PostgreSQL-backed shared state instead of local JSON storage
- Global slash-command registration
- Components V2 UI with custom HoneyCord emoji support
- Automatic setup of one or multiple honeypot channels per server
- Fast moderation path: moderation does not wait for DM delivery
- Softban, ban and kick support
- Optional branded DM cards with HoneyCord website link
- Visible troubleshooting card when Discord rejects an action
- Admin-only `/honeypot panel` command for short honeypot notes
- Server owners and administrators can write in honeypots without moderation
- Protected user IDs for owners and test accounts
- Dry-run mode for safe testing
- Docker Compose and systemd deployment files

## How it works

1. HoneyCord joins a server.
2. It creates or repairs the configured number of honeypot channels.
3. It posts a compact Components V2 warning.
4. A message in that channel is deleted and recorded in PostgreSQL.
5. HoneyCord performs the configured moderation action.
6. If enabled, the user receives a branded DM card.

HoneyCord does **not** create a separate moderation-log channel. PostgreSQL stores the audit data used for counters and status information.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- Discord bot application
- Message Content Intent
- Server Members Intent

The bot role needs View Channels, Send Messages, Embed Links, Manage Channels, Manage Messages, Kick Members and Ban Members. Its highest role must be above users it needs to moderate.

## Quick start with Docker

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose logs -f honeycord
```

Keep `HONEYCORD_DRY_RUN=true` for the first test. For production, set it to `false` only after checking the role hierarchy and protected IDs.

## Environment

Required values:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
POSTGRES_PASSWORD=long_random_password
DATABASE_URL=postgresql://honeycord:long_random_password@postgres:5432/honeycord
```

Useful options:

```env
DISCORD_TEST_GUILD_ID=      # optional; instant command registration while testing
HONEYCORD_EMOJI_ID=         # numeric ID of the honeycord_new app emoji
PROTECTED_USER_IDS=         # comma-separated Discord user IDs
TRIGGER_ACTION=softban      # softban, ban or kick
DELETE_MESSAGE_SECONDS=3600
DM_TRIGGERED_USERS=true
HONEYCORD_DRY_RUN=true
DEFAULT_HONEYPOT_NAME=honey-pot
HONEYCORD_HONEYPOT_COUNT=1   # 1–20 monitored honeypot channels per server
```

Leave `DISCORD_TEST_GUILD_ID` empty in production so commands are registered globally. Global command propagation can take some time.

## Commands

- `/honeypot setup` — create or repair all configured honeypot channels
- `/honeypot status` — show protection and moderation statistics
- `/honeypot enable` — enable moderation for the server
- `/honeypot disable` — pause moderation for the server
- `/honeypot channel` — show the configured honeypot channel

## Project layout

```text
src/manager.js      shard manager and global command registration
src/worker.js       Discord event worker
src/db.js           PostgreSQL schema and queries
src/components.js   Components V2 message builders
src/commands.js     slash-command definitions
docker-compose.yml  HoneyCord + PostgreSQL deployment
deploy/             systemd unit
```

## Production notes

- Never commit `.env` or bot tokens.
- Keep `HONEYCORD_DRY_RUN=true` while testing.
- Add administrator and owner IDs to `PROTECTED_USER_IDS`.
- Softban is deliberately two Discord requests: ban, then unban. Use `kick` when the fastest single moderation request is more important than message cleanup.
- Discord controls shard allocation and may require approval for privileged intents at large scale.
- Back up PostgreSQL before changing the deployment.

## License

Private HoneyCord project. Add a license before publishing the repository publicly.
