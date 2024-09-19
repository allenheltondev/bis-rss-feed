import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';

async function run() {
  if (process.env.ENVIRONMENT !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
  }

  const app = express();
  app.listen(8000, () => {
    console.log('Listening on port 8000. This is for the AppRunner health check.');
  });

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

  client.login(process.env.DISCORD_TOKEN);
}

run();
