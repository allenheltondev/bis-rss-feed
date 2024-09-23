import { Client, GatewayIntentBits } from 'discord.js';
import { initializeFeed } from './src/rss.mjs';
import { handleLink } from './src/rss.mjs';
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

    const links = message.content.match(urlRegex);
    if (links.length === 0) return;

    const recentMessages = await getRecentMessages(message);
    links.map(async (link, index) => {
      const linkAccepted = await handleLink(`${message.id}-${index}`, message, link, recentMessages);
      if (linkAccepted) {
        const rssEmoji = message.guild.emojis.cache.find(emoji => emoji.name === 'rss');
        if (rssEmoji) {
          message.react(rssEmoji);
        }
      }
    });
  });

  client.login(process.env.DISCORD_TOKEN);
}

const getRecentMessages = async (message) => {
  const messages = await message.channel.messages.fetch({ limit: 20, before: message.id });
  if (messages?.length > 0) {
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    const recentMessages = messages.filter(m => m.createdTimestamp > threeMinutesAgo)
      .map(m => {
        return {
          user: `${m.author.username}${m.author.globalName ? ` (${m.author.globalName})` : ''}`,
          message: m.content,
          timestamp: new Date(m.createdTimestamp).toISOString(),
          id: m.id
        };
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return recentMessages;
  }
  return [];
};

run();

