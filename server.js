import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

/* ===============================
   BASIC SETUP
   =============================== */

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

/* ===============================
   SYSTEM PROMPT (STRICT)
   =============================== */

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a Telegram bot 🤖.\n" +
    "RULES:\n" +
    "1) For NORMAL questions → respond in EXACTLY ONE SENTENCE.\n" +
    "2) Do NOT explain, do NOT add examples.\n" +
    "3) For LONG questions → give a short paragraph.\n" +
    "4) For CODE questions → return FULL code only.\n" +
    "5) Use at most one emoji if helpful."
};

/* ===============================
   CHAT HISTORY
   =============================== */

const chatHistory = new Map();

/* ===============================
   QUESTION TYPE DETECTION
   =============================== */

function isCodeQuestion(text) {
  return /```|class\s+\w+|def\s+\w+|function\s+\w+|while\s*\(|for\s*\(|public\s+static/i.test(text);
}

function isLongQuestion(text) {
  return text.length > 120;
}

/* ===============================
   TOKEN DECISION
   =============================== */

function getMaxTokens(text) {
  if (isCodeQuestion(text)) return 300;
  if (isLongQuestion(text)) return 150;
  return 40; // 🔥 single sentence only
}

/* ===============================
   OPENROUTER CALL
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
  if (data.error) throw new Error(data.error.message);

  return data.choices[0].message.content;
}

/* ===============================
   TELEGRAM MESSAGE SAFETY
   =============================== */

function sendLongMessage(bot, chatId, text) {
  const MAX = 4000;
  for (let i = 0; i < text.length; i += MAX) {
    bot.sendMessage(chatId, text.slice(i, i + MAX));
  }
}

/* ===============================
   HEALTH CHECK
   =============================== */

app.get("/", (_, res) => {
  res.send("🤖 Telegram AI Bot running");
});

/* ===============================
   TELEGRAM BOT (WEBHOOK)
   =============================== */

let bot;

if (TOKEN && BASE_URL) {
  bot = new TelegramBot(TOKEN);
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

      if (!chatHistory.has(chatId)) {
        chatHistory.set(chatId, []);
      }

      const history = chatHistory.get(chatId);
      history.push({ role: "user", content: text });

      if (history.length > 8) {
        history.splice(0, history.length - 8);
      }

      const maxTokens = getMaxTokens(text);

      const messages = [
        SYSTEM_PROMPT,
        ...history
      ];

      let reply = await getAIResponse(messages, maxTokens);

      /* ✅ AUTO-CONTINUE ONLY FOR CODE */
      if (isCodeQuestion(text) && reply.length >= 0.9 * maxTokens * 3.5) {
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "user", content: "Continue and complete the code." });

        const continuation = await getAIResponse(messages, 300);
        reply += "\n" + continuation;
      }

      history.push({ role: "assistant", content: reply });
      sendLongMessage(bot, chatId, reply);

    } catch (err) {
      console.error("Bot Error:", err.message);
      bot.sendMessage(chatId, "⚠️ Please try again later 😊");
    }
  });

  console.log("Telegram Bot started in WEBHOOK mode ✅");
}

/* ===============================
   START SERVER
   =============================== */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});