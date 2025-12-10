# Deployment Guide

To run your bot 24/7, you need to deploy it to a cloud provider.

## Option 1: Railway (Recommended for ease of use)

Railway is very easy to set up. It offers a trial, but eventually, you may need to pay a small amount (approx $5/mo) to keep it running 24/7.

1.  **Create a GitHub Account**: If you don't have one, sign up at [github.com](https://github.com).
2.  **Upload your code to GitHub**:
    *   Create a new repository on GitHub.
    *   Upload the files (`bot.py`, `requirements.txt`, `Procfile`, `runtime.txt`) to the repository.
    *   *Note: Do NOT upload `.env`. You will set these variables in Railway.*
3.  **Sign up for Railway**: Go to [railway.app](https://railway.app) and login with GitHub.
4.  **Create a New Project**:
    *   Click "New Project" -> "Deploy from GitHub repo".
    *   Select your repository.
    *   Railway will detect the `Procfile` and start building.
5.  **Set Environment Variables**:
    *   Go to the "Variables" tab in your Railway project.
    *   Add `TELEGRAM_TOKEN` with your token value.
    *   Add `OPENROUTER_API_KEY` with your key value.
6.  **Done!**: Railway will restart the bot, and it will run 24/7.

## Option 2: Render (Alternative)

Render has a free tier for "Web Services", but they spin down after inactivity. For a bot that runs 24/7, you typically need a "Background Worker" which is a paid feature ($7/mo).

1.  **Upload to GitHub** (same as above).
2.  **Sign up for Render**: Go to [render.com](https://render.com).
3.  **Create a New Background Worker**:
    *   Click "New" -> "Background Worker".
    *   Connect your GitHub repository.
    *   Runtime: **Python 3**.
    *   Build Command: `pip install -r requirements.txt`.
    *   Start Command: `python bot.py`.
4.  **Set Environment Variables**:
    *   In the "Environment" tab, add `TELEGRAM_TOKEN` and `OPENROUTER_API_KEY`.
5.  **Deploy**: Click "Create Background Worker".

## Option 3: VPS (Advanced)

If you have a VPS (Virtual Private Server) like DigitalOcean, Linode, or AWS EC2:

1.  **SSH into your server**.
2.  **Clone your code** or upload it.
3.  **Install dependencies**: `pip install -r requirements.txt`.
4.  **Run with a process manager** like `systemd` or `supervisor` to keep it running even if it crashes or the server restarts.
