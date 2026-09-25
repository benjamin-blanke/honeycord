require('dotenv').config();

const path = require('node:path');
const { REST, Routes, ShardingManager } = require('discord.js');
const { commands } = require('./commands');

for (const name of ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DATABASE_URL']) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Fill .env before starting HoneyCord.`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit();

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DISCORD_TEST_GUILD_ID
    ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_TEST_GUILD_ID)
    : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`[HoneyCord] ${process.env.DISCORD_TEST_GUILD_ID ? 'test-guild' : 'global'} commands registered.`);
}

async function main() {
  await registerCommands();
  const manager = new ShardingManager(path.join(__dirname, 'worker.js'), {
    token: process.env.DISCORD_TOKEN,
    totalShards: process.env.SHARD_COUNT && process.env.SHARD_COUNT !== 'auto' ? Number(process.env.SHARD_COUNT) : 'auto',
  });
  manager.on('shardCreate', (shard) => console.log(`[HoneyCord] shard ${shard.id} started.`));
  await manager.spawn({ amount: 'auto', delay: 5000 });
}

main().catch((error) => { console.error('[HoneyCord] manager failed:', error); process.exitCode = 1; });
