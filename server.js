import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

/* ===============================
   SYSTEM PROMPT
   =============================== */

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a Telegram bot 🤖.\n" +
    "Rules:\n" +
    "1) Normal questions → exactly one complete sentence.\n" +
    "2) Long questions → short paragraph.\n" +
    "3) Code questions → full code only.\n" +
    "4) Use at most one emoji."
};

/* ===============================
   HELPERS
   =============================== */

function isCodeQuestion(text) {
  return /```|function\s+\w+|class\s+\w+|def\s+\w+/i.test(text);
}

function isLongQuestion(text) {
  return text.length > 120;
}

function getMaxTokens(text) {
  if (isCodeQuestion(text)) return 300;
  if (isLongQuestion(text)) return 150;
  return 40;
}

/* ===============================
   OPENROUTER REQUEST
   =============================== */

async function getAIResponse(messages, maxTokens) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.AI_API_KEY}`
    },
    body: JSON.stringify({
      model: "openai/gpt-3.5-turbo",
      messages,
      max_tokens: maxTokens,
      temperature: 0.5
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

/* ===============================
   TELEGRAM BOT (WEBHOOK)
   =============================== */

const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${BASE_URL}/webhook`);

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  try {
    bot.sendChatAction(chatId, "typing");

    const messages = [
      SYSTEM_PROMPT,
      { role: "user", content: text }
    ];

    const reply = await getAIResponse(messages, getMaxTokens(text));
    bot.sendMessage(chatId, reply);

  } catch (err) {
    bot.sendMessage(chatId, "⚠️ Please try again later");
  }
});

/* ===============================
   START SERVER
   =============================== */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});