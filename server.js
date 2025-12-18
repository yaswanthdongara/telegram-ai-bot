import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();


const app = express();
app.use(express.json());

// Store conversation history in memory
const chatHistory = new Map();

/* ===============================
   AI Logic
   =============================== */
async function getAIResponse(messages) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.AI_API_KEY}`
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: messages
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.choices || data.choices.length === 0) {
             throw new Error("No response from AI provider");
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Service Error:", error);
        throw error;
    }
}

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
        // For the API endpoint, we treat it as a single turn conversation for now
        const messages = [{ role: "user", content: userMessage }];
        const aiText = await getAIResponse(messages);
        res.json({ reply: aiText });

    } catch (error) {
        res.status(500).json({ error: "Failed to contact AI service" });
    }
});

/* ===============================
   Telegram Bot (Polling Mode)
   =============================== */
if (process.env.TELEGRAM_BOT_TOKEN) {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
        polling: true
    });

    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return;

        try {
            // Send a "typing..." action
            bot.sendChatAction(chatId, 'typing');

            // Initialize history for this chat if it doesn't exist
            if (!chatHistory.has(chatId)) {
                chatHistory.set(chatId, []);
            }

            const history = chatHistory.get(chatId);
            
            // Add user message to history
            history.push({ role: "user", content: text });

            // Keep history size manageable (e.g., last 10 messages)
            if (history.length > 20) {
                history.splice(0, history.length - 20);
            }

            const reply = await getAIResponse(history);
            
            // Add AI response to history
            history.push({ role: "assistant", content: reply });

            bot.sendMessage(chatId, reply);

        } catch (error) {
            console.error("Bot Error:", error);
            bot.sendMessage(chatId, "❌ AI service error. Please try again later.");
        }
    });
    console.log("Telegram Bot started...");
} else {
    console.warn("TELEGRAM_BOT_TOKEN is missing in .env file. Bot will not start.");
}

/* ===============================
   Start Server
   =============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
