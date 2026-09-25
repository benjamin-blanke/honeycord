const { MessageFlags } = require('discord.js');

const appEmoji = process.env.HONEYCORD_EMOJI_ID
  ? { id: process.env.HONEYCORD_EMOJI_ID, name: 'honeycord_new' }
  : { name: '🍯' };
const emojiMention = process.env.HONEYCORD_EMOJI_ID ? `<:honeycord_new:${process.env.HONEYCORD_EMOJI_ID}>` : '🍯';

function textDisplay(content) { return { type: 10, content }; }
function separator() { return { type: 14, divider: true, spacing: 1 }; }
function linkButton(label, url, emoji = appEmoji) {
  return { type: 2, style: 5, label, url, ...(emoji ? { emoji: typeof emoji === 'string' ? { name: emoji } : emoji } : {}) };
}
function actionButton(label, customId, { disabled = false, emoji = appEmoji } = {}) {
  return { type: 2, style: 2, label, custom_id: customId, disabled, ...(emoji ? { emoji: typeof emoji === 'string' ? { name: emoji } : emoji } : {}) };
}
function container(children, accent = 0xF0B34A) { return { type: 17, accent_color: accent, components: children }; }

function guideComponents(guild, config) {
  return [container([
    textDisplay(`## ${emojiMention} Welcome to the HoneyCord honeypot!`),
    textDisplay(`### DO NOT SEND MESSAGES IN THIS CHANNEL\nThis channel is used to catch spam bots. Any message here will result in a **${process.env.TRIGGER_ACTION || 'softban'}**.`),
    ...(config?.panel_text ? [textDisplay(`**Honey Panel**\n${config.panel_text}`)] : []),
    { type: 1, components: [actionButton(`Kicks: ${config?.trigger_count || 0}`, 'honeycord:kicks')] },
  ])];
}

function statusComponents(guild, config, globalStats) {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord status`),
    textDisplay(`**Server:** ${guild.name}\n**Protection:** ${config.enabled ? 'Enabled' : 'Disabled'}\n**Moderated here:** ${config.trigger_count}\n**Global servers:** ${globalStats.servers}\n**Global moderations:** ${globalStats.triggers}`),
    separator(),
    textDisplay(`HoneyCord is watching <#${config.honeypot_channel_id}>. Keep the channel visible, but never send normal messages there.`),
    { type: 1, components: [actionButton('Refresh status', `honeycord:status:${guild.id}`, { emoji: '🔄' })] },
  ])];
}

function honeyInfoComponents(guild, config) {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord`),
    textDisplay('HoneyCord protects Discord servers by catching spam bots and compromised accounts in a dedicated honeypot channel.'),
    separator(),
    textDisplay(`**Kicks recorded:** ${config.trigger_count}\n**Protection:** ${config.enabled ? 'Enabled' : 'Disabled'}\n**Server:** ${guild.name}`),
    { type: 1, components: [linkButton('HoneyCord website', 'https://honeycord.blanke.lol', '🌐')] },
  ])];
}

function triggeredDmComponents(guild, action) {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord action`),
    textDisplay(`You triggered the HoneyCord honeypot in **${guild.name}**.`),
    separator(),
    textDisplay(`Moderation action: **${action}**\nYour message was removed because this channel is reserved for spam-bot detection.`),
    { type: 1, components: [linkButton('HoneyCord website', 'https://honeycord.blanke.lol', '🌐')] },
  ], 0xE5484D)];
}

function sanctionFailureComponents(guild, member, action) {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord could not ${action} this user`),
    textDisplay(`I detected **${member.user.tag}**, but Discord refused the moderation action in **${guild.name}**.`),
    { type: 1, components: [actionButton('Troubleshoot', 'honeycord:troubleshoot', { emoji: '🛠️' })] },
  ], 0xE5484D)];
}

function troubleshootComponents() {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord troubleshooting`),
    textDisplay('Check these items:\n• HoneyCord has **Kick Members** / **Ban Members** permission.\n• HoneyCord\'s highest role is above the detected member.\n• The member is not the server owner.\n• The bot was not timed out or restricted by channel permissions.'),
    separator(),
    { type: 1, components: [linkButton('HoneyCord website', 'https://honeycord.blanke.lol', '🌐')] },
  ])];
}

function serverAssistantComponents(guild, checks, config) {
  const failed = checks.filter((check) => !check.ok);
  const lines = checks.map((check) => `${check.ok ? '✅' : '❌'} **${check.label}:** ${check.detail}`).join('\n');
  return [container([
    textDisplay(`## ${emojiMention} Server Assistant`),
    textDisplay(`Setup health for **${guild.name}**\n\n${lines}`),
    separator(),
    textDisplay(failed.length ? `**${failed.length} issue(s) need attention.** Fix them before enabling live moderation.` : `**Everything looks good.** ${config?.enabled ? 'Protection is enabled.' : 'Protection is currently disabled.'}`),
    { type: 1, components: [linkButton('Open HoneyCord', 'https://honeycord.blanke.lol', '🌐')] },
  ], failed.length ? 0xE5484D : 0x2FBF71)];
}

function setupAssistantComponents(guild) {
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord setup assistant`),
    textDisplay(`Welcome to **${guild.name}**! HoneyCord is ready to set up a honeypot.\n\nClick the button below to create the protected channel and install the warning message.`),
    { type: 1, components: [actionButton('Create Honeypot', 'honeycord:create-honeypot', { emoji: appEmoji })] },
  ])];
}

function detailedStatsComponents(guild, config, stats) {
  const summary = stats.summary;
  const channelLines = stats.channels.length
    ? stats.channels.map((channel) => `• <#${channel.channel_id}> — **${channel.trigger_count}**`).join('\n')
    : '• No honeypot activity yet';
  const actionLines = stats.actions.length
    ? stats.actions.map((item) => `• ${item.action}: **${item.count}**`).join('\n')
    : '• No actions recorded yet';
  return [container([
    textDisplay(`## ${emojiMention} HoneyCord statistics`),
    textDisplay(`**${guild.name}**\nProtection: **${config.enabled ? 'Enabled' : 'Disabled'}**\nAll-time detections: **${summary.total_events}**\nLast 24 hours: **${summary.last_24h}**\nLast 7 days: **${summary.last_7d}**\nDry-run events: **${summary.dry_run_events}**`),
    separator(),
    textDisplay(`**Activity by honeypot**\n${channelLines}\n\n**Actions**\n${actionLines}`),
    { type: 1, components: [linkButton('HoneyCord website', 'https://honeycord.blanke.lol', '🌐')] },
  ])];
}

module.exports = { MessageFlags, guideComponents, statusComponents, honeyInfoComponents, triggeredDmComponents, sanctionFailureComponents, troubleshootComponents, serverAssistantComponents, setupAssistantComponents, detailedStatsComponents };
