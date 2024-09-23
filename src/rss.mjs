import RSS from 'rss';
import ogs from 'open-graph-scraper';
import { getContextPrompt, getRelevancePrompt } from './prompts.mjs';
import { save, load, chat } from './bagOfTricks.mjs';
import { parseStringPromise } from 'xml2js';

let feed;
export const initializeFeed = async () => {
  feed = new RSS({
    title: "Believe in Serverless",
    description: "Find all the cool links shared from the Believe in Serverless community",
    feed_url: "https://believeinserverless.com/rss",
    site_url: "https://believeinserverless.com",
    language: "en",
  });

  const existingFeed = await load({ key: 'rss.xml' });
  if(existingFeed){
    const parsedFeed = await parseStringPromise(existingFeed);
    parsedFeed.rss.channel[0].item.map(item => {
      feed.item({
        title: item.title[0],
        description: item.description[0],
        url: item.link[0],
        date: item.pubDate[0],
        author: item['dc:creator'][0],
        guid: item.guid[0]['_'],
        categories: [item.category[0]]
      });
    })
  }
};

export const handleLink = async (id, discordMessage, link, recentMessages) => {
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
    const answer = await chat({ chatId: id, message: prompt });
    let relevance = answer.match(/<relevance>(.*?)<\/relevance>/)[1];
    if (relevance) {
      relevance = parseInt(relevance);
    }
    if (relevance < 7) return false;

    let description = site.ogDescription;
    if(recentMessages.length > 1){
      const transcript = recentMessages.map(m => `${m.user}: ${m.message}`).join('\n');
      const contextPrompt = getContextPrompt(transcript);
      description = await chat({ chatId: id, message: contextPrompt });
    }

    feed.item({
      title: site.ogTitle,
      description,
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
