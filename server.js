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
   SYSTEM PROMPT (Emoji + Tone)
   =============================== */

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a friendly Telegram bot 🤖. Reply interactively using relevant emojis 😊✨. Keep answers concise, clear, and helpful. Do not overuse emojis."
};

/* ===============================
   CHAT HISTORY STORE
   =============================== */

const chatHistory = new Map(); // chatId -> messages[]

/* ===============================
   AI RESPONSE FUNCTION
   =============================== */

async function getAIResponse(messages) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages,
        max_tokens: 75,     // ✅ short & cheap
        temperature: 0.7
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.choices[0].message.content;
}

/* ===============================
   HEALTH CHECK
   =============================== */

app.get("/", (_, res) => {
  res.send("🤖 Telegram AI Bot is running");
});

/* ===============================
   TELEGRAM BOT (WEBHOOK MODE)
   =============================== */

let bot;

if (TOKEN && BASE_URL) {
  bot = new TelegramBot(TOKEN);

  bot.setWebHook(`${BASE_URL}/webhook`);
  console.log("Webhook set:", `${BASE_URL}/webhook`);

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

      // Add user message
      history.push({ role: "user", content: text });

      // Limit history to last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      // Inject system prompt
      const messages = [
        SYSTEM_PROMPT,
        ...history
      ];

      const reply = await getAIResponse(messages);

      // Save assistant reply
      history.push({ role: "assistant", content: reply });

      bot.sendMessage(chatId, reply);

    } catch (err) {
      console.error("Bot Error:", err.message);
      bot.sendMessage(
        chatId,
        "⚠️ Oops! Something went wrong. Please try again later 😊"
      );
    }
  });

  console.log("Telegram Bot started in WEBHOOK mode ✅");

} else {
  console.warn("Missing TELEGRAM_BOT_TOKEN or RENDER_EXTERNAL_URL");
}

/* ===============================
   START SERVER
   =============================== */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
