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
   SYSTEM PROMPT
   =============================== */

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a friendly Telegram bot 🤖. Use relevant emojis sparingly 😊✨. " +
    "For coding questions, ALWAYS return the FULL code without truncation. " +
    "For normal questions, keep answers short and clear."
};

/* ===============================
   CHAT HISTORY
   =============================== */

const chatHistory = new Map(); // chatId -> messages[]

/* ===============================
   TOKEN DECISION LOGIC
   =============================== */

function isCodeQuestion(text) {
  return (
    text.includes("code") ||
    text.includes("class ") ||
    text.includes("def ") ||
    text.includes("{") ||
    text.includes("}") ||
    text.includes("function") ||
    text.includes("while") ||
    text.includes("for(") ||
    text.includes("```")
  );
}

function isLongText(text) {
  return text.length > 120;
}

function getMaxTokens(text) {
  if (isCodeQuestion(text)) return 300;
  if (isLongText(text)) return 150;
  return 50;
}

function looksTruncated(text) {
  return (
    !text.trim().endsWith(".") &&
    !text.trim().endsWith("!") &&
    !text.trim().endsWith("?") &&
    !text.trim().endsWith("```")
  );
}

/* ===============================
   AI RESPONSE FUNCTION
   =============================== */

async function getAIResponse(messages, maxTokens) {
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
        max_tokens: maxTokens,
        temperature: 0.7
      })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.choices[0].message.content;
}

/* ===============================
   HEALTH CHECK
   =============================== */

app.get("/", (_, res) => {
  res.send("🤖 Telegram AI Bot running");
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
      history.push({ role: "user", content: text });

      // Limit history to last 10 messages
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      const maxTokens = getMaxTokens(text);

      const messages = [
        SYSTEM_PROMPT,
        ...history
      ];

      let reply = await getAIResponse(messages, maxTokens);

      // Auto-continue for truncated code responses
      if (isCodeQuestion(text) && looksTruncated(reply)) {
        messages.push({ role: "assistant", content: reply });
        messages.push({
          role: "user",
          content: "Continue the remaining code completely."
        });

        const continuation = await getAIResponse(messages, 300);
        reply = reply + "\n" + continuation;
      }

      history.push({ role: "assistant", content: reply });
      bot.sendMessage(chatId, reply);

    } catch (err) {
      console.error("Bot Error:", err.message);
      bot.sendMessage(
        chatId,
        "⚠️ Something went wrong. Please try again later 😊"
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
