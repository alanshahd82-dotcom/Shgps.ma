# 🚀 SHGPS Deployment Guide

    ## What You Need

    | Item | Cost | Where |
    |------|------|-------|
    | VPS (Ubuntu 22.04, 2 GB RAM) | ~$12/mo | [Hostinger](https://hostinger.com) or [Contabo](https://contabo.com) |
    | Domain name | ~$10/yr | Namecheap, GoDaddy, or any registrar |
    | Google Play account | $25 one-time | [play.google.com/console](https://play.google.com/console) |
    | Apple Developer account | $99/yr | [developer.apple.com](https://developer.apple.com) |

    ---

    ## Step 1 — Set Up Your VPS

    ```bash
    # Connect to your server
    ssh root@YOUR_SERVER_IP

    # Install Docker + Docker Compose
    curl -fsSL https://get.docker.com | sh
    apt install docker-compose-plugin -y

    # Clone your repo
    git clone https://github.com/alanshahd82-dotcom/Shgps.ma.git
    cd Shgps.ma
    ```

    ## Step 2 — Configure Environment

    ```bash
    cp .env.example .env
    nano .env   # fill in your values
    ```

    ## Step 3 — Build Frontend

    ```bash
    npm install
    npm run build   # creates dist/ folder
    ```

    ## Step 4 — Start Everything

    ```bash
    # Initialise the database
    docker compose up -d postgres
    sleep 5
    docker compose run --rm backend node src/db/init.js

    # Start all services
    docker compose up -d
    ```

    ## Step 5 — Point Your Domain

    Add these DNS records at your registrar:

    ```
    A   @          YOUR_SERVER_IP
    A   www        YOUR_SERVER_IP
    ```

    ## Step 6 — Configure GS900 Devices

    On each device, set the server address to:
    - **IP/Domain**: YOUR_SERVER_IP or your domain
    - **Port**: **5023** (Wanway protocol)

    ## Step 7 — Build Mobile Apps

    ```bash
    # Install Capacitor platforms
    npm run cap:add:android
    npm run cap:add:ios

    # Build + sync
    npm run build
    npm run cap:sync

    # Open in Android Studio / Xcode
    npm run cap:android
    npm run cap:ios
    ```

    Then submit to Play Store / App Store from Android Studio / Xcode.

    ---

    ## Default Admin Login
    - **Email**: admin@shgps.ma
    - **Password**: Admin@1234  ← **Change this immediately after first login!**

    ## Architecture

    ```
    GS900 Devices → port 5023 → Traccar (GPS server)
                                      ↓
    Browser/App → Nginx → Node.js Backend → Traccar REST API
                              ↓
                        PostgreSQL (users, devices, alerts)
    ```
    