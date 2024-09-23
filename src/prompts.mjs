export const getRelevancePrompt = (site) => {
  return `Determine if the webpage details provided below are technically relevant to the Believe in Serverless community. The page should be about serverless or something related to modern application development. Return your answer in a <relevance> tag on a scale of 1-10, with 1 being not at all relevant and 10 being extremely relevant.
      Details:
        url: ${site.url}
        ogTitle: ${site.ogTitle}
        ogDescription: ${site.ogDescription}
        ogType: ${site.ogType}
        ogUrl: ${site.ogUrl}
        ogSiteName: ${site.ogSiteName}
      `;
};

export const getContextPrompt = (messages) => {
  return `Given the following conversation thread from the Believe in Serverless Discord server, determine if there is any relevant context that should be shared when creating an rss feed item for the link. Make your response contain only the description that should be included in the rss feed item. It should be a combination of conversational context and description from the og metadata.
    Conversation:
      ${messages}`;
};
