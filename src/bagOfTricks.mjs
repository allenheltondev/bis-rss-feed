import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CacheClient, CacheListFetchResponse, CacheListConcatenateBackResponse, CacheGetResponse, CacheSetResponse } from '@gomomento/sdk';
import { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';

const s3 = new S3Client();
const bedrock = new BedrockRuntimeClient();
const cacheClient = new CacheClient({ defaultTtlSeconds: 300 }); // Gets credentials from process.env.MOMENTO_API_KEY

/**
 * Prompt an LLM. Can be used for one-shot queries or conversations. Uses Momento Cache to retain message history automatically.
 * You must set the `MOMENTO_API_KEY` and `CACHE_NAME` environment variables for conversation history to be kept.
 * The LLM model can be set by configuring the `MODEL_ID` environment variable.
 *
 * *Requires the `bedrock:InvokeModel` IAM permission.*
 *
 * @param {Object} params
 * @param {string} props.message - REQUIRED! The message to send to the LLM
 * @param {string} [props.chatId] - A unique identifier for the conversation. Conversation history will be recorded if this is provided
 * @param {string} [props.systemMessage] - Used to position the LLM for answering a specific way
 * @returns {string} Text response from the LLM
 *
 * @example
 * const response = await chat({ message: 'What is the capital of France?' });
 *
 * @example
 * const response = await chat({ chatId: 'abc', message: 'Then what happened?'});
 */
export const chat = async (params) => {
  let messages = [];

  // Load conversation history, if it exists
  if (params.chatId) {
    const historyResponse = await cacheClient.listFetch(process.env.CACHE_NAME, params.chatId);
    switch (historyResponse.type) {
      case CacheListFetchResponse.Hit:
        messages = historyResponse.valueListString().map(JSON.parse);
        break;
      case CacheListFetchResponse.Error:
        console.error(historyResponse.toString());
    }
  }

  // Add the new message to the conversation
  const newMessage = { role: 'user', content: [{ type: 'text', text: params.message }] };
  messages.push(newMessage);

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: process.env.MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      max_tokens: 10000,
      anthropic_version: "bedrock-2023-05-31",
      messages,
      ...params.systemMessage && { system: params.systemMessage }
    })
  }));

  const answer = JSON.parse(new TextDecoder().decode(response.body));
  const modelResponse = answer.content[0].text;

  // Save new messages to conversation history, if applicable
  if(params.chatId){
    const newChatMessages = [JSON.stringify(newMessage), JSON.stringify({role: 'assistant', content: answer.content})];
    const updateHistoryResponse = await cacheClient.listConcatenateBack(process.env.CACHE_NAME, params.chatId, newChatMessages);
    switch(updateHistoryResponse.type){
      case CacheListConcatenateBackResponse.Error:
        console.error(updateHistoryResponse.toString());
    }
  }

  return modelResponse;
};



/**
 * @typedef {('json' | 'string' | 'binary')} TransformType
 */

/**
 * Loads a value from S3. It will first check Momento cache to see if the value exists and fall back if it does not.
 *
 * *Requires the `s3:getObject` IAM permission.*
 * *You must set the `CACHE_NAME`, `MOMENTO_API_KEY`, and `BUCKET_NAME` environment variables
 * @param {*} params
 * @param {string} params.key - REQUIRED! Full file name, including prefix
 * @param {TransformType} [params.transform] - How to return the value. Defaults to string
 * @returns {*} Contents from the requested file or default value if it does not exist
 *
 * @example
 * const value = await load({ key: 'path/to/file.json', transform: 'json' });
 */
export const load = async (params) => {
  const cachedItem = await cacheClient.get(process.env.CACHE_NAME, params.key);
  switch (cachedItem.type) {
    case CacheGetResponse.Hit:
      switch (params.transform) {
        case 'json':
          return JSON.parse(cachedItem.valueString());
        case 'binary':
          return cachedItem.valueUint8Array();
        default:
          return cachedItem.valueString();
      }
    default:
      console.info(`Cache miss for ${params.key}`);
  }

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: params.key
    }));

    switch (params.transform) {
      case 'json':
        const output = await response.Body.transformToString();
        return JSON.parse(output);
      case 'binary':
        return response.Body.transformToByteArray();
      default:
        return response.Body.transformToString();
    }
  } catch (err) {
    if (err instanceof NoSuchKey) {
      console.warn(`Key ${params.key} not found in bucket`);
      switch (params.transform) {
        case 'json':
          return {};
        case 'binary':
          return new Uint8Array();
        default:
          return '';
      }
    }

    console.error(JSON.stringify(err));
    throw err;
  }
};

/**
 * Saves a value to S3 and Momento cache.
 *
 * *Requires the `s3:putObject` IAM permission.*
 * *You must set the `CACHE_NAME`, `MOMENTO_API_KEY`, and `BUCKET_NAME` environment variables

 * @param {*} params
 * @param {string} params.key - REQUIRED! Full file name, including prefix
 * @param {*} params.value - REQUIRED! Value to store
 * @param {number} [params.ttl] - How long to store the value in seconds (defaults to 300)
 * @param {Boolean} [params.isPublic] - Indicates if the value has a `publicread` ACL
 *
 * * @example
 * await save({ key: 'path/to/file.json', value: { foo: 'bar' }, ttl: 60, isPublic: true });
 */
export const save = async (params) => {
  let value = params.value;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    value = JSON.stringify(value);
  }

  await s3.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: params.key,
    Body: value,
    ...params.isPublic && { ACL: 'public-read' }
  }));

  const setResponse = await cacheClient.set(process.env.CACHE_NAME, params.key, value, { ...params.ttl && { ttl: params.ttl } });
  switch (setResponse.type) {
    case CacheSetResponse.Error:
      console.warn(`Error updating cache: ${setResponse.toString()}`);
      break;
    default:
      console.info(`Updated cache for ${params.key}`);
      break;
  }
};

