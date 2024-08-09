import { Client, Databases, Query, ID, Models, Locale } from 'node-appwrite';
import { Telegraf } from 'telegraf';

//import * as process from './env.js';

function log(text: string) {
  console.log(text);
}
function error(text: string) {
  console.error(text);
}

type Context = {
  req: any;
  res: any;
  log: (msg: string) => void;
  error: (msg: string) => void;
};

export interface HistoryItem {
  role: 'model' | 'user';
  parts: {
    text: string;
  }[];
}

export interface Message extends Models.Document {
  $id: string;
  message: string;
  thought: Thought;
  bot: boolean;
  chat: Chat;
}

export interface Thought extends Models.Document {
  thought: string;
  message: Message;
  chat: Chat;
}

export interface Chat {
  $id: string;
  chat_id: string;
  channel: 'telegram' | 'alexa';
  messages: Message[];
}

export interface Module {
  name: string;
  description: string;
  queue: string[];
  actions: string[];
  events: string[];
}
export interface SlotLtm {
  key: string;
  value: string[];
}

export interface Es {
  $id: string;
  fear?: number;
  happiness?: number;
  sadness?: number;
  anger?: number;
  surprise?: number;
  disgust?: number;
  anxiety?: number;
  excitement?: number;
  frustration?: number;
  satisfaction?: number;
  curiosity?: number;
  boredom?: number;
  nostalgia?: number;
  hope?: number;
  pride?: number;
  shame?: number;
  concentration?: number;
  confusion?: number;
  calm?: number;
  stress?: number;
  creativity?: number;
  empathy?: number;
  logic?: number;
  humor?: number;
  learning?: number;
  connection?: number;
  autonomy?: number;
}

export interface Profile extends Models.Document {
  name: string;
  chats: Chat[];
  es: Es;
  queue: string[];
  ltm: SlotLtm[];
  modules: Module[];
}

export interface Action {
  module: string;
  channel: string;
  action: 'input' | 'output';
  payload: {
    value: string;
    type: string;
    chatid: string;
  };
  thought: Thought;
}

export default async ({ req, res, log, error }: Context) => {
  function debug(text: string) {
    if (process.env.DEBUG!.toLowerCase() === 'true') {
      error(`debug: ${text}`);
    }
  }
  const telegram_token = req.headers['x-telegram-bot-api-secret-token'];
  try {
    log(`Test api key`);
    if (telegram_token === process.env.APPWRITE_API_KEY!) {
      log('connect to Telegram Bot');
      const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);
      log('connect to appwrite api');
      const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT!)
        .setProject(process.env.APPWRITE_PROJECT_ID!)
        .setKey(process.env.APPWRITE_API_KEY!);
      let datastore = new Databases(client);
      let chat = await datastore.listDocuments(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_TABLE_CHATS_ID!,
        [
          Query.equal('channel', 'telegram'),
          Query.equal('chatid', String(req.body.message.chat.id)),
          Query.limit(1),
        ]
      );
      switch (req.body.message.text) {
        case '/start':
          log('present the bot at users'); //in future use gemini directly
          bot.telegram.sendMessage(
            String(req.body.message.chat.id),
            'Hello everyone! I am an AI under development, with learning and conversational abilities. To start interacting with me, type the magic word. 😉 What is the magic word?'
          );
          break;
        case 'start@imitation@game':
          log('Registrazione Bot');
          if (chat.total === 0) {
            log('User not present');
            const locale = new Locale(client);
            const languages = await locale.listLanguages();
            let user_language: string = 'english';
            for (const language of languages.languages) {
              if (language.code === req.body.message.from.language_code)
                user_language = language.name;
            }
            const new_user = {
              es: { fear: 0 },
              ltm: [
                {
                  key: 'first_name_user',
                  value: [req.body.message.from.first_name],
                },
                {
                  key: 'last_name_user',
                  value: [req.body.message.from.last_name],
                },
                {
                  key: 'user_language',
                  value: [user_language],
                },
                {
                  key: 'username_user',
                  value: [req.body.message.from.username],
                },
              ],
              name: req.body.message.from.username,
              chats: [
                {
                  channel: 'telegram',
                  chatid: String(req.body.message.chat.id),
                },
              ],
            };
            log(`write new user`);
            debug(`new user: ${JSON.stringify(new_user)}`);
            await datastore.createDocument(
              process.env.APPWRITE_DATABASE_ID!,
              process.env.APPWRITE_TABLE_PROFILES_ID!,
              ID.unique(),
              new_user
            );
            log(`user created`);
            bot.telegram.sendMessage(
              String(req.body.message.chat.id),
              "You managed to say the magic word and now we can finally start interacting. 🤖 If you're curious to see what commands I can execute, visit t.me/giul_ia_actions_bot, while if you want to take a look at my thought process, I'm waiting for you at t.me/giul_ia_think_bot. To interact with me, just write in this chat! 😉 Up until now, you've been shown prerendered text, now the magic happens." //in future use gemini directly
            );
          } else {
            bot.telegram.sendMessage(
              String(req.body.message.chat.id),
              'Welcome Back to Giulia BOT' //in future use gemini directly
            );
            log(`user already in database`);
          }
          break;
        default:
          if (chat.total > 0) {
            datastore.createDocument(
              process.env.APPWRITE_DATABASE_ID!,
              process.env.APPWRITE_TABLE_MESSAGES_ID!,
              ID.unique(),
              {
                chat: chat.documents[0].$id,
                message: req.body.message.text,
              }
            );

            log('add message to user chat');
          } else {
            error('No User Found');
            bot.telegram.sendMessage(
              String(req.body.message.chat.id),
              "i'm curious to get to know you, but to interact with you, you'll need to say the magic word! 😉 What are you waiting for? 😄"
            );
          }
      }
    } else {
      debug(JSON.stringify(req.body));
      const action: Action = req.body;
      debug(`action: ${JSON.stringify(action)}`);
      if (action.action === 'input' || action.action === 'output') {
        if (
          action.module === 'core' &&
          action.action === 'input' &&
          action.channel === 'telegram'
        ) {
          log('add message in conversation');
          log('connect to appwrite api');
          const client = new Client()
            .setEndpoint(process.env.APPWRITE_ENDPOINT!)
            .setProject(process.env.APPWRITE_PROJECT_ID!)
            .setKey(process.env.APPWRITE_API_KEY!);
          let datastore = new Databases(client);
          datastore.createDocument(
            process.env.APPWRITE_DATABASE_ID!,
            process.env.APPWRITE_TABLE_MESSAGES_ID!,
            ID.unique(),
            {
              message: action.payload.value,
              bot: true,
              chat: action.thought.chat.$id,
            }
          );
          log('connect to Telegram Bot');
          const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);
          log(`sent message to telegram channel to ${action.payload.chatid}`);
          bot.telegram.sendMessage(
            String(action.payload.chatid),
            action.payload.value
          );
        } else {
          console.log(JSON.stringify(req));
          const bot = new Telegraf(process.env.TELEGRAM_TOKEN_ACTION!);
          log(`sent action to telegram channel`);
          bot.telegram.sendMessage(
            action.thought.chat.$id,
            JSON.stringify(action)
          );
        }
      } else {
        error('api key not is valid');
      }
    }
    if (req.method === 'GET') {
      return res.send('Silicia - Giul-IA BOT - telegram gateway');
    }
  } catch (e: any) {
    error(`error: ${e}`);
  }
  return res.empty();
};
