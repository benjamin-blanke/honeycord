const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Manage HoneyCord')
    .addSubcommand((s) => s.setName('setup').setDescription('Create or repair the honeypot channels'))
    .addSubcommand((s) => s.setName('status').setDescription('Show HoneyCord status'))
    .addSubcommand((s) => s.setName('enable').setDescription('Enable automatic moderation'))
    .addSubcommand((s) => s.setName('disable').setDescription('Disable automatic moderation'))
    .addSubcommand((s) => s.setName('channel').setDescription('Show the honeypot channel'))
    .addSubcommand((s) => s.setName('panel').setDescription('Set the short Honey Panel text')
      .addStringOption((o) => o.setName('text').setDescription('Text; leave empty to clear the panel').setMaxLength(300).setRequired(false)))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('HoneyCord server tools')
    .addSubcommand((s) => s.setName('assistant').setDescription('Check permissions and setup health'))
    .addSubcommand((s) => s.setName('stats').setDescription('Show detailed server statistics'))
    .toJSON(),
];

module.exports = { commands };
