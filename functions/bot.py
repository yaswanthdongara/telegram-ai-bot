import os
import json
import logging
import asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters
from openai import AsyncOpenAI

# Configure logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# Environment variables
TELEGRAM_TOKEN = os.environ.get('TELEGRAM_TOKEN')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')

# Initialize OpenAI
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

# NOTE: In a serverless environment (Netlify), global variables like this 
# are NOT persistent. The bot will "forget" the conversation after each request.
# To fix this, you would need a database (like Redis or MongoDB).
conversation_history = {} 

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(chat_id=update.effective_chat.id, text="I'm a bot running on Netlify! (Note: I have no memory in this mode)")

async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text
    
    try:
        # Simple stateless chat for Netlify
        completion = await client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://telegram.org",
                "X-Title": "Telegram Bot",
            },
            model="openai/gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": user_message}
            ]
        )
        
        bot_response = completion.choices[0].message.content
        await context.bot.send_message(chat_id=update.effective_chat.id, text=bot_response)
        
    except Exception as e:
        logging.error(f"Error: {e}")
        await context.bot.send_message(chat_id=update.effective_chat.id, text="Error processing request.")

# Initialize Application
application = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
application.add_handler(CommandHandler('start', start))
application.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), chat))

async def handler(event, context):
    """
    Netlify Function Handler
    """
    try:
        if event['httpMethod'] == 'POST':
            data = json.loads(event['body'])
            
            # Create update object
            update = Update.de_json(data, application.bot)
            
            # Process update
            await application.initialize()
            await application.process_update(update)
            await application.shutdown()
            
            return {
                'statusCode': 200,
                'body': 'OK'
            }
            
        return {
            'statusCode': 200,
            'body': 'Bot is running'
        }
    except Exception as e:
        logging.error(f"Error in handler: {e}")
        return {
            'statusCode': 500,
            'body': str(e)
        }
