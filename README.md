# Telegram AI Chatbot

This is a Telegram chatbot powered by OpenRouter AI.

## Setup

1.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configuration:**
    The `.env` file contains your API keys.
    ```
    TELEGRAM_TOKEN=your_telegram_token
    OPENROUTER_API_KEY=your_openrouter_key
    ```

3.  **Run the Bot:**
    ```bash
    python bot.py
    ```

## Running 24/7

To run the bot 24/7, you need to host it on a server. Here are a few options:

*   **VPS (Virtual Private Server):** Rent a VPS (e.g., DigitalOcean, Linode, AWS EC2), clone this repository, and run the bot using a process manager like `systemd` or `supervisor`.
*   **Cloud Platforms:** Use platforms like Railway, Render, or Heroku. You will need to add the environment variables in their dashboard.
*   **Local Machine:** Keep your computer on and the script running.

## Features

*   Responds to messages using OpenRouter AI.
*   Uses `python-telegram-bot` for Telegram interaction.
*   Uses `openai` library for API calls.
