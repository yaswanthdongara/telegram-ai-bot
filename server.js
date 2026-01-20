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
   MEMORY STORE (10 exchanges)
   =============================== */

const chatMemory = new Map(); // chatId -> messages[]
const MAX_EXCHANGES = 10; // 10 user + 10 assistant = 20 messages

function updateMemory(chatId, role, content) {
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }

  const history = chatMemory.get(chatId);
  history.push({ role, content });

  // keep only last 20 messages
  if (history.length > MAX_EXCHANGES * 2) {
    chatMemory.set(chatId, history.slice(-MAX_EXCHANGES * 2));
  }
}

/* ===============================
   HELPERS
   =============================== */

function getMaxTokens() {
  return 275;
}

/* ===============================
   OPENROUTER REQUEST
   =============================== */

async function getAIResponse(messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.AI_API_KEY}`
    },
    body: JSON.stringify({
      model: "openai/gpt-3.5-turbo",
      messages,
      max_tokens: getMaxTokens(),
      temperature: 0.4
    })
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
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

    updateMemory(chatId, "user", text);

    const messages = chatMemory.get(chatId);
    const reply = await getAIResponse(messages);

    updateMemory(chatId, "assistant", reply);
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
