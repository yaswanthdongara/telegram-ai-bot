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
    "Always complete sentences and explanations fully. " +
    "For coding questions, always return the FULL code without truncation. " +
    "For normal questions, be concise but never cut off mid-sentence."
};

/* ===============================
   CHAT HISTORY
   =============================== */

const chatHistory = new Map(); // chatId -> messages[]

/* ===============================
   TOKEN DECISION LOGIC
   =============================== */

function isCodeQuestion(text) {
  return /```|class\s+\w+|def\s+\w+|function\s+\w+|while\s*\(|for\s*\(|public\s+static/i.test(
    text
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

// Detect truncation based on token pressure
function looksTruncated(text, maxTokens) {
  return text.length >= Math.floor(maxTokens * 3.5); // ~token → char estimate
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

      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      const maxTokens = getMaxTokens(text);

      const messages = [
        SYSTEM_PROMPT,
        ...history
      ];

      let reply = await getAIResponse(messages, maxTokens);

      // 🔥 AUTO-CONTINUE FOR BOTH CHAT & CODE
      let safetyCounter = 0;
      while (looksTruncated(reply, maxTokens) && safetyCounter < 3) {
        messages.push({ role: "assistant", content: reply });
        messages.push({
          role: "user",
          content: "Please continue and complete the response."
        });

        const continuation = await getAIResponse(
          messages,
          isCodeQuestion(text) ? 300 : 150
        );

        reply += " " + continuation;
        safetyCounter++;
      }

      history.push({ role: "assistant", content: reply });

      sendLongMessage(bot, chatId, reply);

    } catch (err) {
      console.error("Bot Error:", err.message);
      bot.sendMessage(
        chatId,
        "⚠️ Something went wrong. Please try again later 😊"
      );
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