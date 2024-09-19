import { Client, GatewayIntentBits } from 'discord.js';
if(process.env.ENVIRONMENT !== 'production'){
  import('dotenv').then(dotenv => dotenv.config());
}

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
