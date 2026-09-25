require('dotenv').config();

const {
  Client, GatewayIntentBits, Partials, ChannelType, Events, ActivityType, PermissionsBitField,
} = require('discord.js');
const { ensureSchema, getGuildConfig, getHoneypotChannels, upsertHoneypotChannel, setGuildChannels, setEnabled, setPanelText, recordTrigger, getGlobalStats, getServerStats, closeDb } = require('./db');
const { MessageFlags, guideComponents, statusComponents, triggeredDmComponents, sanctionFailureComponents, troubleshootComponents, serverAssistantComponents, setupAssistantComponents, detailedStatsComponents } = require('./components');

const dryRun = String(process.env.HONEYCORD_DRY_RUN || 'true').toLowerCase() === 'true';
const action = process.env.TRIGGER_ACTION || 'softban';
const deleteSeconds = Math.max(0, Math.min(604800, Number(process.env.DELETE_MESSAGE_SECONDS || 3600)));
const protectedIds = new Set((process.env.PROTECTED_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
const monitoredHoneypots = new Set();
const honeypotCount = Math.max(1, Math.min(20, Number(process.env.HONEYCORD_HONEYPOT_COUNT || 1)));

function serverChecks(guild) {
  const me = guild.members.me;
  const permissions = me?.permissions;
  const has = (permission) => Boolean(permissions?.has(permission));
  return [
    { label: 'Bot member', ok: Boolean(me), detail: me ? 'Connected' : 'Not available' },
    { label: 'Manage channels', ok: has(PermissionsBitField.Flags.ManageChannels), detail: has(PermissionsBitField.Flags.ManageChannels) ? 'Available' : 'Missing permission' },
    { label: 'Send messages', ok: has(PermissionsBitField.Flags.SendMessages), detail: has(PermissionsBitField.Flags.SendMessages) ? 'Available' : 'Missing permission' },
    { label: 'Manage messages', ok: has(PermissionsBitField.Flags.ManageMessages), detail: has(PermissionsBitField.Flags.ManageMessages) ? 'Available' : 'Missing permission' },
    { label: 'Kick members', ok: has(PermissionsBitField.Flags.KickMembers), detail: has(PermissionsBitField.Flags.KickMembers) ? 'Available' : 'Missing permission' },
    { label: 'Ban members', ok: has(PermissionsBitField.Flags.BanMembers), detail: has(PermissionsBitField.Flags.BanMembers) ? 'Available' : 'Missing permission' },
    { label: 'Role hierarchy', ok: Boolean(me?.roles?.highest?.position > 0), detail: me?.roles?.highest ? `Highest role: ${me.roles.highest.name}` : 'No usable bot role' },
  ];
}

function nameFor(base) {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (clean || 'honeycord-channel').slice(0, 90);
}

async function ensureChannels(guild) {
  const config = await getGuildConfig(guild.id);
  const baseName = nameFor(process.env.DEFAULT_HONEYPOT_NAME || 'honey-pot');
  const stored = await getHoneypotChannels(guild.id);
  const storedById = new Map(stored.map((row) => [row.channel_id, row]));
  const honeypots = [];
  stored.slice(honeypotCount).forEach((row) => monitoredHoneypots.delete(row.channel_id));

  for (let index = 0; index < honeypotCount; index += 1) {
    const desiredName = index === 0 ? baseName : `${baseName}-${index + 1}`.slice(0, 100);
    const storedChannel = stored[index];
    let honeypot = storedChannel && guild.channels.cache.get(storedChannel.channel_id);
    if (!honeypot && index === 0 && config.honeypot_channel_id) honeypot = guild.channels.cache.get(config.honeypot_channel_id);
    if (!honeypot) honeypot = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === desiredName);
    if (!honeypot) {
      honeypot = await guild.channels.create({ name: desiredName, type: ChannelType.GuildText, topic: 'HoneyCord honeypot — do not send messages here.' });
    }

    await upsertHoneypotChannel(guild.id, honeypot.id, honeypot.name);
    monitoredHoneypots.add(honeypot.id);
    honeypots.push(honeypot);
    const saved = index === 0 ? await setGuildChannels(guild.id, honeypot.id) : config;
    const recent = await honeypot.messages.fetch({ limit: 20 }).catch(() => null);
    const welcome = recent?.find((message) => message.author.id === guild.client.user.id && message.components?.length);
    if (welcome) {
      await welcome.edit({ components: guideComponents(guild, saved), flags: MessageFlags.IsComponentsV2 });
      console.log(`[welcome:${guild.id}:${honeypot.id}] HoneyCord honeypot message synced.`);
    } else {
      await honeypot.send({ components: guideComponents(guild, saved), flags: MessageFlags.IsComponentsV2 });
      console.log(`[welcome:${guild.id}:${honeypot.id}] HoneyCord honeypot message created.`);
    }
  }
  return { honeypots, config: await getGuildConfig(guild.id) };
}

async function syncGuideMessages(guild, config) {
  const channels = await getHoneypotChannels(guild.id);
  for (const row of channels) {
    const channel = guild.channels.cache.get(row.channel_id);
    if (!channel) continue;
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    const welcome = recent?.find((message) => message.author.id === guild.client.user.id && message.components?.length);
    if (welcome) await welcome.edit({ components: guideComponents(guild, config), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  }
}

async function postSetupAssistant(guild) {
  const me = guild.members.me;
  const candidates = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildText
    && channel.permissionsFor(me)?.has(PermissionsBitField.Flags.SendMessages));
  const target = [...candidates.values()][Math.floor(Math.random() * candidates.size)];
  if (!target) return;
  const recent = await target.messages.fetch({ limit: 30 }).catch(() => null);
  const alreadyPosted = recent?.some((message) => message.author.id === guild.client.user.id
    && message.components?.some((row) => row.components?.some((component) => component.content?.includes('setup assistant'))));
  if (alreadyPosted) return;
  await target.send({
    components: setupAssistantComponents(guild),
    flags: MessageFlags.IsComponentsV2,
  }).catch((error) => console.error(`[assistant:${guild.id}]`, error.message));
  console.log(`[assistant:${guild.id}] Setup assistant posted in #${target.name}.`);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (ready) => {
  await ensureSchema();
  monitoredHoneypots.clear();
  console.log(`[HoneyCord] shard ${client.shard?.ids?.join(',') || '0'} logged in as ${ready.user.tag}; dryRun=${dryRun}`);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'HoneyCord', type: ActivityType.Custom, state: process.env.HONEYCORD_CUSTOM_STATUS || 'Protecting servers' }],
  });
  for (const guild of ready.guilds.cache.values()) {
    try {
      const existingPots = await getHoneypotChannels(guild.id);
      if (existingPots.length) await ensureChannels(guild);
      else await postSetupAssistant(guild);
    } catch (error) { console.error(`[setup:${guild.id}]`, error.message); }
  }
});
client.on(Events.GuildCreate, async (guild) => {
  try {
    await postSetupAssistant(guild);
  } catch (error) { console.error(`[guild:${guild.id}]`, error.message); }
});
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'honeycord:create-honeypot' && interaction.guildId) {
    await interaction.deferReply({ ephemeral: true });
    const result = await ensureChannels(interaction.guild);
    await interaction.message.delete().catch(() => {});
    return interaction.editReply(`HoneyCord is ready. Created ${result.honeypots.length} honeypot${result.honeypots.length === 1 ? '' : 's'}: ${result.honeypots.map((channel) => `<#${channel.id}>`).join(', ')}`);
  }
  if (interaction.isButton() && interaction.customId === 'honeycord:kicks' && interaction.guildId) {
    const config = await getGuildConfig(interaction.guildId);
    const { honeyInfoComponents } = require('./components');
    return interaction.reply({ components: honeyInfoComponents(interaction.guild, config), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
  if (interaction.isButton() && interaction.customId === 'honeycord:troubleshoot') {
    return interaction.reply({ components: troubleshootComponents(), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
  if (interaction.isButton() && interaction.customId.startsWith('honeycord:status') && interaction.guildId) {
    const config = await getGuildConfig(interaction.guildId);
    const globalStats = await getGlobalStats();
    return interaction.reply({ components: statusComponents(interaction.guild, config, globalStats), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;
  if (interaction.commandName === 'server') {
    const sub = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guildId);
    if (sub === 'assistant') return interaction.reply({ components: serverAssistantComponents(interaction.guild, serverChecks(interaction.guild), config), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    const stats = await getServerStats(interaction.guildId);
    return interaction.reply({ components: detailedStatsComponents(interaction.guild, config, stats), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
  if (interaction.commandName !== 'honeypot') return;
  const config = await getGuildConfig(interaction.guildId);
  const sub = interaction.options.getSubcommand();
  if (sub === 'setup') { await interaction.deferReply({ ephemeral: true }); const result = await ensureChannels(interaction.guild); return interaction.editReply(`HoneyCord is ready. Honeypots: ${result.honeypots.map((channel) => `<#${channel.id}>`).join(', ')}`); }
  if (sub === 'enable' || sub === 'disable') { const enabled = sub === 'enable'; await setEnabled(interaction.guildId, enabled); return interaction.reply({ content: `Automatic honeypot moderation is now **${enabled ? 'enabled' : 'disabled'}**.`, ephemeral: true }); }
  if (sub === 'panel') {
    const permissions = interaction.memberPermissions;
    const allowed = interaction.guild.ownerId === interaction.user.id
      || permissions?.has(PermissionsBitField.Flags.Administrator)
      || permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!allowed) return interaction.reply({ content: 'Only server administrators can edit the Honey Panel.', ephemeral: true });
    if (!config.honeypot_channel_id) return interaction.reply({ content: 'Create a honeypot first with `/honeypot setup`.', ephemeral: true });
    const panelText = interaction.options.getString('text')?.trim() || null;
    const saved = await setPanelText(interaction.guildId, panelText);
    await syncGuideMessages(interaction.guild, saved);
    return interaction.reply({ content: panelText ? 'Honey Panel updated.' : 'Honey Panel cleared.', ephemeral: true });
  }
  if (sub === 'channel') return interaction.reply({ content: config.honeypot_channel_id ? `Honeypot channel: <#${config.honeypot_channel_id}>` : 'No honeypot channel configured. Run `/honeypot setup`.', ephemeral: true });
  const globalStats = await getGlobalStats();
  return interaction.reply({ components: statusComponents(interaction.guild, config, globalStats), flags: MessageFlags.IsComponentsV2 });
});
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!monitoredHoneypots.has(message.channel.id)) return;
  const config = await getGuildConfig(message.guild.id);
  const permissions = message.member?.permissions;
  const trustedModerator = message.guild.ownerId === message.author.id
    || permissions?.has(PermissionsBitField.Flags.Administrator)
    || permissions?.has(PermissionsBitField.Flags.ManageGuild);
  if (!config.enabled || protectedIds.has(message.author.id) || trustedModerator) return;
  const effectiveAction = config.action || action;
  const effectiveDeleteSeconds = Number(config.delete_seconds || deleteSeconds);
  try {
    const recordPromise = recordTrigger({ guildId: message.guild.id, userId: message.author.id, channelId: message.channel.id, messageId: message.id, action: effectiveAction, dryRun });
    await message.delete().catch(() => {});
    recordPromise.catch((error) => console.error(`[trigger-db:${message.guild.id}]`, error.message));
    if (!dryRun && process.env.DM_TRIGGERED_USERS === 'true') {
      message.author.send({ components: triggeredDmComponents(message.guild, effectiveAction), flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    if (!dryRun) {
      let sanctioned = false;
      if (effectiveAction === 'kick' && message.member?.kickable) { await message.member.kick('HoneyCord honeypot trigger'); sanctioned = true; }
      else if (effectiveAction !== 'kick' && message.member?.bannable) { await message.member.ban({ deleteMessageSeconds: effectiveDeleteSeconds, reason: 'HoneyCord honeypot trigger' }); if (effectiveAction === 'softban') await message.guild.members.unban(message.author.id, 'HoneyCord softban cleanup'); sanctioned = true; }
      if (!sanctioned) {
        const warning = await message.channel.send({ components: sanctionFailureComponents(message.guild, message.member || { user: message.author }, effectiveAction), flags: MessageFlags.IsComponentsV2 });
        setTimeout(() => warning.delete().catch(() => {}), 60000).unref();
      }
    }
  } catch (error) { console.error(`[trigger:${message.guild.id}]`, error.message); }
});

process.on('SIGTERM', async () => { await closeDb(); process.exit(0); });
client.login(process.env.DISCORD_TOKEN).catch((error) => { console.error('[HoneyCord] login failed:', error.message); process.exitCode = 1; });
