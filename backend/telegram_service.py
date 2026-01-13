import logging
import asyncio
import re
from telethon import TelegramClient, functions, types, errors
from telethon.errors import FloodWaitError, UserPrivacyRestrictedError

# --- Configure Structured Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger("Telephasma.Backend")

def clean_text(text):
    """Sanitize text for safe frontend rendering."""
    if not text: return ""
    # Remove any potentially dangerous characters or null bytes
    return text.replace('\x00', '').strip()

class TelegramService:
    def __init__(self):
        self.client = None
        self.phone = None
        self.api_id = None
        self.api_hash = None
        self.stop_requested = False

    def stop_scan(self):
        """Signal all running scans to stop immediately."""
        self.stop_requested = True


    def is_connected(self):
        return self.client and self.client.is_connected()

    async def connect(self, api_id, api_hash, phone):
        """Cleanly initialize and connect the Telegram client with retry logic for DB locks."""
        self.api_id = str(api_id)
        self.api_hash = str(api_hash)
        self.phone = str(phone)
        
        session_path = f"session_{self.phone}"
        max_retries = 5

        for attempt in range(max_retries):
            try:
                self.client = TelegramClient(
                    session_path, 
                    int(self.api_id), 
                    self.api_hash,
                    connection_retries=10,
                    retry_delay=2,
                    timeout=45
                )
                await self.client.connect()
                logger.info(f"Connected to Telegram for {self.phone}")
                return # Connection successful, exit loop
            except Exception as e:
                error_str = str(e).lower()
                if "database is locked" in error_str:
                    wait_s = (attempt + 1) * 1.5
                    logger.warning(f"Database Locked during Init (Attempt {attempt+1}/{max_retries}). Retrying in {wait_s}s...")
                    await asyncio.sleep(wait_s)
                    if attempt == max_retries - 1:
                        logger.error("Max retries reached for DB lock. Failing.")
                        raise
                else:
                    logger.error(f"Connection failed: {e}")
                    raise

    async def send_code(self):
        """Send authentication code to the phone provided."""
        if not await self.client.is_user_authorized():
            await self.client.send_code_request(self.phone)
            return True
        return False

    async def sign_in(self, phone, code, password=None):
        """Handle 2FA and multi-factor sign-in."""
        try:
            return await self.client.sign_in(phone, code)
        except errors.SessionPasswordNeededError:
            if password:
                return await self.client.sign_in(password=password)
            raise Exception("2FA_PASSWORD_REQUIRED")
        except Exception as e:
            logger.error(f"Sign-in failure: {e}")
            raise

    async def safe_call(self, client_or_user, request):
        """Wrapper for Telethon calls with automatic FloodWait and DB Lock handling."""
        max_retries = 5
        for attempt in range(max_retries):
            # Immediate Stop Check
            if self.stop_requested:
                logger.info("API Call aborted due to stop signal.")
                return None

            try:
                # If client_or_user is a TelegramClient instance, use it directly
                if isinstance(client_or_user, TelegramClient):
                    return await client_or_user(request)

                # Fallback: Assume it's a User object or we use the main client
                # If logic requires specific user session, it should be handled here, 
                # but commonly we just use self.client for global requests.
                return await self.client(request)

            except FloodWaitError as e:
                # Check stop before waiting
                if self.stop_requested: return None
                
                wait_time = e.seconds + 2
                logger.warning(f"FloodWait: Sleeping {wait_time}s")
                
                # Sleep in chunks to allow interruption
                for _ in range(wait_time):
                    if self.stop_requested: return None
                    await asyncio.sleep(1)
                await asyncio.sleep(wait_time - int(wait_time)) # Remaining fraction
                
                # Loop continues to retry
            except Exception as e:
                # Check stop immediately
                if self.stop_requested: return None

                error_str = str(e).lower()
                if "database is locked" in error_str:
                    wait_s = (attempt + 1) * 0.5
                    logger.warning(f"Database Locked (Attempt {attempt+1}/{max_retries}). Retrying in {wait_s}s...")
                    await asyncio.sleep(wait_s)
                    continue
                
                if isinstance(e, errors.FilterNotSupportedError): return None
                if isinstance(e, UserPrivacyRestrictedError): return None
                
                logger.error(f"API Call failed: {e}")
                return None
        return None

    async def resolve_peer(self, identifier):
        """Robustly resolve various Telegram identifier formats."""
        if not identifier: return None
        
        # 1. Handle numeric IDs (e.g., -100..., @-100...)
        if isinstance(identifier, int):
            return identifier
        
        if isinstance(identifier, str):
            clean_id = identifier.strip()
            # Handle potential scientific notation or large numbers as strings
            if clean_id.lstrip('-').isdigit():
                numeric_id = int(clean_id)
                # For numeric IDs, try to find the entity in dialogs first (cache population)
                try:
                    async for dialog in self.client.iter_dialogs(limit=200):
                        if dialog.id == numeric_id or dialog.entity.id == abs(numeric_id):
                            logger.info(f"Found entity {numeric_id} in dialogs cache")
                            return dialog.entity
                except Exception as e:
                    logger.warning(f"Dialog iteration for cache population failed: {e}")
                
                # Return the numeric ID anyway, let Telethon try
                return numeric_id
            
            # Handle standard usernames or links
            if clean_id.startswith('https://t.me/'):
                clean_id = clean_id.replace('https://t.me/', '')
            
            return clean_id
            
        return identifier


    async def get_dialogs(self):
        """Fetch group and channel dialogs for the user."""
        if not self.is_connected(): return []
        
        dialogs = []
        try:
            async for dialog in self.client.iter_dialogs(limit=100):
                if dialog.is_group or dialog.is_channel:
                    dtype = "group"
                    if dialog.is_channel: dtype = "channel"
                    if hasattr(dialog.entity, 'megagroup') and dialog.entity.megagroup: dtype = "megagroup"
                    
                    dialogs.append({
                        "id": dialog.id,
                        "name": clean_text(dialog.name),
                        "type": dtype
                    })
        except Exception as e:
            logger.error(f"Dialog fetch error: {e}")
        return dialogs
    
    async def get_participants(self, chat_id):
        """Efficiently get participants for a specific chat."""
        if not self.is_connected(): return []
        
        members = []
        try:
            peer = await self.resolve_peer(chat_id)
            entity = await self.client.get_entity(peer)
            async for user in self.client.iter_participants(entity, limit=500, aggressive=True):
                if user.deleted: continue
                members.append({
                    "id": user.id,
                    "username": user.username or "",
                    "first_name": clean_text(user.first_name),
                    "bot": user.bot if hasattr(user, 'bot') else False
                })
        except Exception as e:
            logger.warning(f"Entity resolution/fetch failed for {chat_id}: {e}")
        return members
    
    async def get_common_groups(self, user_id):
        """Clean mapping of common entities shared with a target."""
        common_groups = []
        try:
            # Resolve peer first to handle string/int mismatches
            peer = await self.resolve_peer(user_id)
            target = await self.client.get_input_entity(peer)
            from telethon.tl.functions.messages import GetCommonChatsRequest
            result = await self.safe_call(self.client, GetCommonChatsRequest(
                user_id=target,
                max_id=0,
                limit=50
            ))
            if not result: return []
            
            for chat in result.chats:
                common_groups.append({
                    "id": chat.id,
                    "name": clean_text(getattr(chat, 'title', 'Private Entity')),
                    "type": "megagroup" if getattr(chat, 'megagroup', False) else "group"
                })
        except Exception as e:
            logger.warning(f"Common groups fetch failed: {e}")
        return common_groups
    
    async def get_user_gifts(self, user_input):
        """Core Intelligence: Fetch Star Gifts for a targeted entity."""
        try:
            entity = await self.client.get_input_entity(user_input)
            result = await self.safe_call(self.client, functions.payments.GetSavedStarGiftsRequest(
                peer=entity,
                offset="",
                limit=100
            ))
            if not result: return [], {}
            
            gifts = []
            for gift in getattr(result, 'gifts', []):
                sender_id = None
                from_id = getattr(gift, 'from_id', None)
                
                if isinstance(from_id, types.PeerUser): sender_id = from_id.user_id
                elif isinstance(from_id, types.PeerChannel): sender_id = from_id.channel_id
                elif isinstance(from_id, types.PeerChat): sender_id = from_id.chat_id
                
                g_date = getattr(gift, 'date', None)
                g_msg = getattr(gift, 'message', None)
                if hasattr(g_msg, 'text'): g_msg = g_msg.text
                
                gifts.append({
                    "id": getattr(gift, 'id', 0),
                    "sender_id": sender_id,
                    "date": g_date.isoformat() if hasattr(g_date, 'isoformat') else str(g_date),
                    "message": clean_text(str(g_msg or "")),
                    "stars": getattr(gift, 'stars', 0)
                })
            
            related_users = {u.id: u for u in getattr(result, 'users', [])}
            return gifts, related_users
        except Exception as e:
            logger.error(f"Gift extraction failed: {e}")
            return [], {}

    def extract_links(self, text):
        """RE-Optimized regex-based intelligence gathering from bios."""
        if not text: return []
        blacklist = {'nohello', 'nohello.org', 'nohello.com', 'nohello.net', 'hello', 'example', 'test', 'username'}
        links = []
        patterns = [
            r"@([a-zA-Z][\w\d_]{4,31})",
            r"(?:https?:\/\/)?t\.me\/(\+?[a-zA-Z0-9_\-]+)",
            r"(?:https?:\/\/)?([a-zA-Z0-9][\w\-]*\.(?:io|com|net|org|in|ag|co|me|ru|cc|gg|xyz|dev|app))"
        ]
        for p in patterns:
            links.extend(re.findall(p, text, re.IGNORECASE))
        return [l for l in set(links) if l.lower() not in blacklist]

    async def scan_user(self, peer, depth=0):
        """Single user analysis component."""
        try:
            if self.stop_requested: return None
            full = await self.safe_call(self.client, functions.users.GetFullUserRequest(peer))
            if self.stop_requested: return None
            if not full: return None
            
            u_obj = full.users[0]
            bio = clean_text(full.full_user.about or "")
            links = self.extract_links(bio)
            
            pch_id = getattr(full.full_user, 'personal_channel_id', None)
            if pch_id:
                try:
                    pe = await self.client.get_entity(pch_id)
                    if hasattr(pe, 'username') and pe.username: links.append(pe.username)
                except: pass
            
            if u_obj.username and u_obj.username in links: links.remove(u_obj.username)
            gifts, rels = await self.get_user_gifts(u_obj)
            
            return {
                "u_id": u_obj.id,
                "u_obj": u_obj,
                "bio": bio,
                "links": list(set(links)),
                "gifts": gifts,
                "related_users": rels
            }
        except Exception as e:
            logger.warning(f"Scan failed for peer {peer}: {e}")
            return None

    async def scan_chat_recursive(self, chat_identifier, depth=1, delay=1.5, target_identifiers=None):
        """Professional Recursive Intelligence Mapper."""
        # Only reset stop flag if we are starting a fresh new run and not currently stopping
        # For simplicity, we assume a new call means a new intention, but we must respect an ongoing stop command if it was just issued.
        # Actually, if the user hits stop, we want EVERYTHING to stop.
        # If they start again, we reset.
        self.stop_requested = False 
        
        visited = set()
        queue = [] # (peer, depth, from_who)
        
        try:
            if target_identifiers:
                # Handle custom list of targets (IDs or Usernames)
                for target in target_identifiers:
                     if self.stop_requested: break
                     try:
                         # Resolve first to ensure we have a valid entity or ID
                         peer = await self.resolve_peer(target)
                         if peer:
                             queue.append((peer, 0, None))
                             # Add to visited to avoid cycle if it appears again
                             if isinstance(peer, int): visited.add(peer)
                             elif hasattr(peer, 'id'): visited.add(peer.id)
                     except Exception as e:
                         logger.warning(f"Could not resolve initial target {target}: {e}")
            else:
                # Default behavior: Scan participants of a chat
                peer = await self.resolve_peer(chat_identifier)
                entity = await self.client.get_entity(peer)
                async for user in self.client.iter_participants(entity, limit=400, aggressive=True):
                    if self.stop_requested: 
                        logger.info("Scan Aborted during participant fetch.")
                        break # Check stop flag
                    if user.bot or user.deleted: continue
                    queue.append((user, 0, None))
                    visited.add(user.id)
            
            while queue:
                if self.stop_requested:
                    logger.info("Scan Aborted during queue processing.")
                    break # Check stop flag

                peer, c_depth, from_who = queue.pop(0)
                if delay > 0: await asyncio.sleep(delay)

                if self.stop_requested: break # Check again after delay

                result = await self.scan_user(peer)
                if not result: continue

                u_id = result["u_id"]
                u_obj = result["u_obj"]
                links = result["links"]
                gifts = result["gifts"]
                rels = result["related_users"]

                # Emit data only if relevant (Strict Filtering: Only users with links are "Found")
                if links:
                    yield {
                        "type": "user_found", 
                        "data": {
                            "id": u_id, "username": u_obj.username, "first_name": clean_text(u_obj.first_name),
                            "type": "channel_owner",
                            "depth": c_depth, "discovered_from": from_who
                        }
                    }
                    yield {
                        "type": "user_detail", 
                        "data": {"id": u_id, "bio": result["bio"], "channel_links": links, "username": u_obj.username}
                    }

                # Always yield gifts if present, for graph connectivity and parsing (even if user isn't shown yet)
                # But we add related_users for name resolution
                if gifts: 
                    # Serialize related_users for frontend name resolution
                    resolved_users = {}
                    for rid, ruser in rels.items():
                         resolved_users[rid] = {
                             "username": getattr(ruser, 'username', None),
                             "first_name": clean_text(getattr(ruser, 'first_name', ""))
                         }
                    
                    yield {
                        "type": "user_gifts", 
                        "data": {
                            "user_id": u_id, 
                            "gifts": gifts,
                            "resolved_users": resolved_users
                        }
                    }
                    if links:
                        yield {
                            "type": "user_detail", 
                            "data": {"id": u_id, "bio": result["bio"], "channel_links": links, "username": u_obj.username}
                        }
                    
                # Expansion
                if c_depth < depth:
                    for g in gifts:
                        if self.stop_requested: break # Check stop flag inside inner loop
                        sid = g.get('sender_id')
                        if not sid or sid in visited: continue
                        visited.add(sid)
                        speer = rels.get(sid) or sid
                        # Intelligence: Pass a readable "Discovered From" label
                        from_label = str(u_id)
                        if u_obj.username: from_label = f"@{u_obj.username}"
                        elif u_obj.first_name: from_label = u_obj.first_name
                        queue.append((speer, c_depth + 1, from_label))


        except Exception as e:
            logger.critical(f"Recursive scan engine failure: {e}")
            yield {"type": "error", "message": f"Scan Critical: {str(e)}"}
