# Telephasma - Telegram Gift Network Analyzer

![Beta](https://img.shields.io/badge/Status-Beta-yellow)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB)

A powerful OSINT tool for analyzing Telegram gift-giving networks and channel ownership relationships. Telephasma scans Telegram groups/channels to discover users, map their gift transactions, and identify channel owners through bio analysis.

## 🎯 Features

- **User Discovery**: Scan Telegram groups/channels to extract member profiles
- **Gift Chain Analysis**: Track who sends gifts to whom, building relationship networks
- **Channel Owner Detection**: Identify users who own channels/groups via bio parsing
- **Real-time Visualization**: Interactive force-directed graph showing user relationships
- **Recursive Scanning**: Follow gift chains to discover connected users
- **Multi-language UI**: English and Turkish interface support


## 📋 Prerequisites

- Python 3.10+
- Node.js 18+
- Telegram API credentials (api_id and api_hash from https://my.telegram.org)

## 🚀 Installation

### 🎯 Quick Start (Recommended)

| Platform | Command |
|----------|---------|
| **🪟 Windows** | Double-click `start.bat` |
| **🐧 Linux / 🍎 Mac** | `chmod +x start.sh && ./start.sh` |

**This will automatically:**
- ✅ Create Python virtual environment
- ✅ Install all dependencies (backend + frontend)
- ✅ Start both servers
- ✅ Open your browser

---

### Manual Installation

<details>
<summary>Click to expand manual installation steps</summary>

#### Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

#### Frontend Setup

```bash
cd frontend
npm install
```

##### ⚠️ Windows PowerShell Error Fix

If you see this error when running `npm install`:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

**Solution 1: Use CMD instead of PowerShell (Easiest)**
```cmd
# Open CMD (Command Prompt) instead of PowerShell, then:
cd frontend
npm install
```

**Solution 2: Enable script execution in PowerShell (Run as Administrator)**
```powershell
# Open PowerShell as Administrator, then run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# After this, you can run npm commands normally
```

</details>

## ⚙️ Configuration

On first run, you will be prompted to enter:
1. **API ID**: Your Telegram API ID (get from https://my.telegram.org)
2. **API Hash**: Your Telegram API Hash
3. **Phone Number**: Your Telegram phone number (with country code, e.g., +1234567890)
4. **Verification Code**: Login code sent to your Telegram app

> **Note**: Your credentials are stored locally and never shared. Each user must provide their own Telegram API credentials.

## 🎮 Running the Application

### Start Backend
```bash
cd backend
python main.py
# Server runs on http://localhost:8000
```

### Start Frontend
```bash
cd frontend
npm run dev
# UI runs on http://localhost:5173
```

Open your browser and navigate to `http://localhost:5173`

## 📖 How It Works

### 1. Authentication
The backend connects to Telegram using the Telethon library. Your session is saved locally for future use.

### 2. Scanning Process
```
Target Group/Channel
        │
        ▼
  Get Members List
        │
        ▼
  For Each Member:
        ├──► Parse Bio (extract channel links)
        ├──► Get Gifts Received
        └──► If gifts found:
                  │
                  ▼
           Get Gift Senders
                  │
                  ▼
           Recursively Scan Senders
```

### 3. Data Classification
- **TARGET**: Users from the initial scan target
- **DISCOVERED**: Users found through gift chains who own channels
- **CHANNEL**: Telegram channels/groups extracted from user bios

### 4. Network Visualization
The Network Map uses a D3 force-directed graph to display:
- **Circles**: User nodes (red = target, cyan = discovered)
- **Squares**: Channel nodes (purple)
- **Lines**: Gift relationships and channel ownership connections

## 🖼️ Screenshots

### Login Screen
![Login Screen](Screenshot/Login%20Screen.png)

### Discovery Tab
![Discovery Tab](Screenshot/Discovery%20Tab%20Screen.png)

### Live Scan Tab
![Live Scan Tab](Screenshot/Live%20Scan%20Tab%20Screen.png)

### Results Tab
![Results Tab](Screenshot/Results%20Tab%20Screen.png)

### Network Visualization
![Network Visualization](Screenshot/Network%20Tab%20Screen.png)
The interactive network map shows relationships between users and channels with real-time updates during scanning.

### Results Panel
Detailed user information including channels owned, gifts sent/received, and bio content.

## ⚠️ Disclaimer

This tool is intended for **educational and research purposes only**. 

- Use responsibly and in accordance with Telegram's Terms of Service
- Do not use for harassment, stalking, or any malicious purposes
- The developers are not responsible for any misuse of this tool
- Respect user privacy and data protection regulations

## 📄 License

MIT License - See LICENSE file for details.

---

Made with ❤️ for OSINT researchers
