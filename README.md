<h1 align="center">
  <a href="https://honeycord.blanke.lol" target="_blank">
    <img src="https://honeycord.blanke.lol/honeycord-logo.png" alt="HoneyCord Logo" width="90">
  </a>
  <br>
  HoneyCord
</h1>

<p align="center">
  <strong>Catch Bots. Keep Humans. 🍯</strong>
</p>

> HoneyCord is a lightweight Discord security bot that uses honeypot-based detection to catch automated spam without bothering real members.

## How it works

1. [**Invite HoneyCord**](https://discord.com/oauth2/authorize?client_id=1552723613239607397) to your Discord server.
2. Create and configure a dedicated honeypot channel.
3. HoneyCord quietly monitors the trap for suspicious activity.
4. When automated spam takes the bait, HoneyCord detects the trigger and takes action.
5. Your real members continue using the server normally.

> **ⓘ Note:** HoneyCord is designed as an additional security layer. You can use it alongside your existing moderation bots.

<details>
<summary><strong>Why HoneyCord?</strong></summary>

### Security without annoying humans

Most anti-bot systems put another obstacle between real users and your community.

HoneyCord takes a different approach.

Instead of requiring every member to complete verification or a CAPTCHA, HoneyCord creates a trap specifically for unwanted automation.

Spam bots often send messages across available channels without understanding what those channels are for. A honeypot takes advantage of that behavior.

When the trap is triggered, HoneyCord can react before the spam spreads further.

### Built to stay simple

HoneyCord isn't trying to become another massive all-in-one Discord bot.

It focuses on one job:

**Detect unwanted automation and keep it away from your community.**

That means:

* 🍯 Honeypot-based detection
* ⚡ Automatic reactions
* 🛡️ Focused server protection
* 👤 No CAPTCHA walls for normal members
* 🔧 Simple configuration
* 🪶 Lightweight by design

> *"Spam walks in. HoneyCord shuts it down."*

</details>

<details>
<summary><strong>Tips</strong></summary>

### Getting the most out of HoneyCord

Place your honeypot somewhere automated spam is reasonably likely to encounter it.

Keep the channel separate from normal conversations so legitimate members don't accidentally interact with the trap.

Make sure HoneyCord has the permissions required to perform the configured moderation actions and that its role is positioned correctly in your server hierarchy.

For setup instructions and recommendations, see the [**documentation**](https://honeycord.blanke.lol/docs).

</details>

## Links

* 🍯 [**Invite HoneyCord**](https://discord.com/oauth2/authorize?client_id=1552723613239607397)
* 📖 [**Documentation**](https://honeycord.blanke.lol/docs)
* 💬 [**Support Server**](https://honeycord.blanke.lol/server)
* 🌐 [**Website**](https://honeycord.blanke.lol)
* 🐛 [**Report a Bug**](https://honeycord.blanke.lol/bug-report)
* 💡 [**Request a Feature**](https://honeycord.blanke.lol/feature-request)
* 🔐 [**Security**](https://honeycord.blanke.lol/security)
* 📝 [**Changelog**](https://honeycord.blanke.lol/changelog)

## Getting Started (dev)

Clone the repository:

```bash
git clone https://github.com/benjamin-blanke/honeycord.git
cd honeycord
```

Install dependencies:

```bash
npm install
```

Configure your environment variables:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=1552723613239607397
```

Start HoneyCord:

```bash
npm start
```

> Never commit your Discord token or other credentials to the repository.

## Self-hosting

You can run your own HoneyCord instance using the source code in this repository.

Before deploying, make sure you have:

* A Discord application and bot
* Node.js installed
* The required environment variables
* Appropriate Discord permissions
* A persistent hosting environment

Or simply use the official hosted version:

[**Add HoneyCord to your server →**](https://discord.com/oauth2/authorize?client_id=1552723613239607397)

## Contributing

Bug fixes, improvements and useful contributions are welcome.

For larger changes, please open an issue first so the idea can be discussed before implementation.

Keep contributions focused on HoneyCord's main goal: **simple and effective honeypot protection for Discord communities.**

<sub>

---

Made with 🍯 by **B Tech**
© 2026 B Tech · [Website](https://honeycord.blanke.lol) · [Support](https://honeycord.blanke.lol/server)

</sub>
