import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";

const app = express();
app.use(express.json());

/* ===============================
   Health Check Route
   =============================== */
app.get("/", (req, res) => {
    res.send("Telegram AI Bot server is running 🚀");
});

/* ===============================
   AI Chat Endpoint
   =============================== */
app.post("/chat", async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.AI_API_KEY}`
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: [{ role: "user", content: userMessage }]
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(500).json({ error: data.error.message });
        }

        const aiText = data.choices[0].message.content;
        res.json({ reply: aiText });

    } catch (error) {
        res.status(500).json({ error: "Failed to contact AI service" });
    }
});

/* ===============================
   Telegram Bot (Polling Mode)
   =============================== */
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    try {
        const response = await fetch("https://telegram-ai-bot-pf9d.onrender.com/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();
        bot.sendMessage(chatId, data.reply || "⚠️ No response from AI.");

    } catch (error) {
        bot.sendMessage(chatId, "❌ AI service error.");
    }
});

/* ===============================
   Start Server
   =============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
