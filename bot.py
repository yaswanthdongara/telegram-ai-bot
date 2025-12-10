import os
import logging
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Initialize OpenAI client for OpenRouter
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logging.info("Start command received")
    await context.bot.send_message(chat_id=update.effective_chat.id, text="I'm a bot, please talk to me!")

async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text
    logging.info(f"Received message: {user_message}")
    
    try:
        # Call OpenRouter API
        logging.info("Sending request to OpenRouter...")
        completion = await client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://telegram.org", # Optional, for including your app on openrouter.ai rankings.
                "X-Title": "Telegram Bot", # Optional. Shows in rankings on openrouter.ai.
            },
            model="openai/gpt-3.5-turbo", # You can change this to other models supported by OpenRouter
            messages=[
                {
                    "role": "user",
                    "content": user_message
                }
            ]
        )
        
        bot_response = completion.choices[0].message.content
        logging.info(f"Received response from OpenRouter: {bot_response}")
        await context.bot.send_message(chat_id=update.effective_chat.id, text=bot_response)
        
    except Exception as e:
        logging.error(f"Error calling OpenRouter: {e}")
        await context.bot.send_message(chat_id=update.effective_chat.id, text=f"Error: {str(e)}")

if __name__ == '__main__':
    if not TELEGRAM_TOKEN:
        print("Error: TELEGRAM_TOKEN not found in .env file")
        exit(1)
        
    application = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    
    start_handler = CommandHandler('start', start)
    chat_handler = MessageHandler(filters.TEXT & (~filters.COMMAND), chat)
    
    application.add_handler(start_handler)
    application.add_handler(chat_handler)
    
    print("Bot is running...")
    application.run_polling()
