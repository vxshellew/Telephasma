from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import json
from telegram_service import TelegramService, logger

app = FastAPI(title="Telephasma Pro 2.0")

# Optimized CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tg = TelegramService()

# --- Models ---
class LoginRequest(BaseModel):
    api_id: str
    api_hash: str
    phone: str

class VerifyRequest(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None

# --- Endpoints ---
@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        await tg.connect(req.api_id, req.api_hash, req.phone)
        sent = await tg.send_code()
        return {"status": "code_sent" if sent else "already_authorized"}
    except Exception as e:
        logger.error(f"Login edge failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/verify")
async def verify(req: VerifyRequest):
    try:
        await tg.sign_in(req.phone, req.code, req.password)
        return {"status": "success"}
    except Exception as e:
        if "2FA_PASSWORD_REQUIRED" in str(e):
            return {"status": "2fa_required"}
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/dialogs")
async def get_dialogs():
    return await tg.get_dialogs()

@app.get("/api/chat/{chat_id}/members")
async def get_members(chat_id: str):
    return await tg.get_participants(chat_id)

@app.get("/api/user/{user_id}/common-groups")
async def get_common_groups(user_id: str):
    return await tg.get_common_groups(user_id)

@app.post("/api/stop-scan")
async def stop_scan_endpoint():
    tg.stop_scan()
    return {"status": "stopped"}


# --- Intelligence WebSocket ---
@app.websocket("/ws/scan/{chat_id}")
async def websocket_scan(websocket: WebSocket, chat_id: str):
    await websocket.accept()
    
    try:
        # 1. Configuration handshake
        params = websocket.query_params
        depth = int(params.get("depth", 1))
        delay = float(params.get("delay", 1.5))
        recursive = params.get("recursive", "true").lower() == "true"
        custom_targets = params.get("targets")
        
        target_identifiers = None
        if custom_targets:
            # Handle both numeric IDs and usernames (strings)
            raw_targets = custom_targets.split(",")
            target_identifiers = []
            for t in raw_targets:
                t = t.strip()
                if not t: continue
                # Keep as string for service to resolve, or cast to int if purely numeric
                if t.lstrip('-').isdigit():
                    target_identifiers.append(int(t))
                else:
                    target_identifiers.append(t)

        logger.info(f"Scan Start | Chat: {chat_id} | Depth: {depth} | Delay: {delay}")
        
        # 2. Execution Loop
        async for update in tg.scan_chat_recursive(
            chat_id, 
            depth=depth if recursive else 0,
            delay=delay,
            target_identifiers=target_identifiers
        ):
            await websocket.send_text(json.dumps(update))
            
        await websocket.send_text(json.dumps({"type": "status", "message": "Scan Comprehensive - Complete"}))
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for chat {chat_id}")
    except Exception as e:
        logger.critical(f"WebSocket Crash: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except: pass
    finally:
        try:
            await websocket.close()
        except: pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
