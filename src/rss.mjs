import RSS from 'rss';
import ogs from 'open-graph-scraper';
import { getRelevancePrompt } from './prompts.mjs';
import { save, load, chat } from './bagOfTricks.mjs';

let feed;
export const initializeFeed = async () => {
  feed = new RSS({
    title: "Believe in Serverless",
    description: "Find all the cool links shared from the Believe in Serverless community",
    feed_url: "https://believeinserverless.com/rss",
    site_url: "https://believeinserverless.com",
    language: "en",
  });
};

export const handleLink = async (id, discordMessage, link) => {
  try {
    const ogData = await ogs({ url: link });
    const site = {
      url: link,
      ogTitle: ogData.result.ogTitle,
      ogDescription: ogData.result.ogDescription,
      ogType: ogData.result.ogType,
      ogUrl: ogData.result.ogUrl,
      ogSiteName: ogData.result.ogSiteName
    };

    const prompt = getRelevancePrompt(site);
    const answer = await chat({ chatId: discordMessage.id, message: prompt });
    let relevance = answer.match(/<relevance>(.*?)<\/relevance>/)[1];
    if (relevance) {
      relevance = parseInt(relevance);
    }
    if (relevance < 7) return false;

    feed.item({
      title: site.ogTitle,
      description: site.ogDescription,
      url: site.url,
      date: discordMessage.createdAt.toISOString(),
      author: discordMessage.author.tag,
      guid: id,
      categories: [discordMessage.channel.name]
    });

    const newFeed = feed.xml({ indent: true });
    await save({ key: 'rss.xml', value: newFeed, isPublic: true });
    return true;
  } catch (err) {
    console.error(err);
  }
};
