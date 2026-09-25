# HoneyCord Update — Interactive Server Setup

## New invite flow

HoneyCord no longer creates a honeypot immediately when it joins a server.

After being invited, HoneyCord now:

1. Posts a setup assistant in a random writable text channel.
2. Shows a **Create Honeypot** button.
3. Creates all configured honeypots only after an administrator clicks the button.
4. Removes the setup assistant message after successful creation.

This keeps server onboarding explicit and prevents unwanted channels from appearing automatically.

## New server tools

- `/server assistant` checks permissions, role hierarchy and moderation readiness.
- `/server stats` shows all-time, 24-hour and 7-day activity.
- Statistics include activity per honeypot and moderation actions.

## Multiple honeypots

Set `HONEYCORD_HONEYPOT_COUNT` in `.env` to create multiple honeypots during setup. The supported range is 1–20.

## Safety

- Existing production configuration remains in use.
- Existing honeypots are preserved.
- Moderation behavior is unchanged.
- The setup button only creates channels when explicitly clicked.

## Honey Panel

Administrators can use `/honeypot panel text:<message>` to add a short note to the honeypot card. Leave the text empty to clear it. Server owners, administrators and users with **Manage Server** can also write in the honeypot without their messages being removed or moderated.
