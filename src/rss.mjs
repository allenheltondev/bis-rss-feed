import RSS from 'rss';
//import { save, load } from './bagOfTricks.mjs';

let feed;
export const initializeFeed = async () => {
  feed = new RSS({
    title: "Believe in Serverless Shared Links",
    description: "Find all the cool links shared from the Believe in Serverless community",
    feed_url: "https://believeinserverless.com/rss",
    site_url: "https://believeinserverless.com",
    language: "en",
  });
};

export const handleLink = async (discordMessage, link) => {

}
