import { Client, GatewayIntentBits } from 'discord.js';
import { initializeFeed } from './src/rss.mjs';
import express from 'express';

const urlRegex = /(https?:\/\/[^\s]+)/g;

async function run() {
  if (process.env.ENVIRONMENT !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
  }

  const app = express();
  app.listen(8000, () => {
    console.log('Listening on port 8000. This is for the AppRunner health check.');
  });

  await initializeFeed();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    console.log(JSON.stringify(message));

    // TODO: Identify links in message and call rss `handleLink` function to process for relevance
  });

  client.login(process.env.DISCORD_TOKEN);
}

run();

