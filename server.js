import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ===============================
// Store conversation history
// ===============================
const chatHistory = new Map();

// ===============================
// AI Logic
// ===============================
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
        max_tokens: 75, 
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

// ===============================
// Health check
// ===============================
app.get("/", (req, res) => {
  res.send("Telegram AI Bot server is running 🚀");
});

// ===============================
// Telegram Webhook Bot
// ===============================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL; // Render provides this

let bot;

if (TOKEN && BASE_URL) {
  bot = new TelegramBot(TOKEN);

  // Set webhook
  bot.setWebHook(`${BASE_URL}/webhook`);
  console.log("Webhook set:", `${BASE_URL}/webhook`);

  // Telegram webhook endpoint
  app.post("/webhook", async (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // Handle messages
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

      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      const reply = await getAIResponse(history);

      history.push({ role: "assistant", content: reply });
      bot.sendMessage(chatId, reply);

    } catch (err) {
      console.error("Bot Error:", err);
      bot.sendMessage(chatId, "❌ AI service error. Please try again later.");
    }
  });

  console.log("Telegram Bot started in WEBHOOK mode ✅");
} else {
  console.warn("Missing TELEGRAM_BOT_TOKEN or RENDER_EXTERNAL_URL");
}

// ===============================
// Start server
// ===============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});


