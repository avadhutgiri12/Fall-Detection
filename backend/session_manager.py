"""
Session Manager for tracking user sessions and cleaning up on page refresh.
"""

import time
import uuid
from typing import Dict, List, Optional, Set
from fastapi import WebSocket
from connection_manager import connection_manager


class SessionManager:
    """Manages user sessions and their associated WebSocket connections."""

    def __init__(self):
        self.sessions: Dict[str, Dict] = {}  # session_id -> session_data
        self.session_connections: Dict[str, Set[str]] = {}  # session_id -> set of connection_ids

    def create_session(self, session_id: Optional[str] = None) -> str:
        """Create a new session."""
        if session_id is None:
            session_id = str(uuid.uuid4())[:12]

        # Ensure unique session_id
        while session_id in self.sessions:
            session_id = str(uuid.uuid4())[:12]

        self.sessions[session_id] = {
            "created_at": time.time(),
            "last_activity": time.time(),
            "user_agent": "",
            "ip": "",
        }
        self.session_connections[session_id] = set()
        return session_id

    def register_connection(self, session_id: str, connection_id: str) -> bool:
        """Register a WebSocket connection to a session."""
        if session_id not in self.sessions:
            return False

        self.session_connections[session_id].add(connection_id)
        self.sessions[session_id]["last_activity"] = time.time()
        return True

    def unregister_connection(self, session_id: str, connection_id: str) -> bool:
        """Unregister a WebSocket connection from a session."""
        if session_id in self.session_connections:
            self.session_connections[session_id].discard(connection_id)
            return True
        return False

    def get_session_connections(self, session_id: str) -> List[str]:
        """Get all connection IDs for a session."""
        return list(self.session_connections.get(session_id, set()))

    def cleanup_session(self, session_id: str) -> int:
        """Clean up all connections for a session and remove session."""
        connections = self.get_session_connections(session_id)
        closed_count = 0

        for connection_id in connections:
            ws = connection_manager.get_connection(connection_id)
            if ws:
                # Close the WebSocket connection
                try:
                    import asyncio
                    asyncio.create_task(ws.close(code=1000, reason="Session ended"))
                except Exception:
                    pass
                connection_manager.disconnect(connection_id)
                closed_count += 1

        # Remove session data
        self.session_connections.pop(session_id, None)
        self.sessions.pop(session_id, None)

        return closed_count

    def update_activity(self, session_id: str) -> bool:
        """Update session last activity timestamp."""
        if session_id in self.sessions:
            self.sessions[session_id]["last_activity"] = time.time()
            return True
        return False

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session data."""
        return self.sessions.get(session_id)

    def get_stats(self) -> Dict:
        """Get session statistics."""
        total_connections = sum(len(conns) for conns in self.session_connections.values())
        return {
            "active_sessions": len(self.sessions),
            "total_connections": total_connections,
            "sessions": {
                sid: {
                    "connections": len(conns),
                    "created_at": self.sessions[sid]["created_at"],
                    "last_activity": self.sessions[sid]["last_activity"],
                }
                for sid, conns in self.session_connections.items()
            }
        }

    def cleanup_stale_sessions(self, max_age_seconds: int = 3600) -> int:
        """Clean up sessions older than max_age_seconds."""
        now = time.time()
        stale_sessions = [
            sid for sid, data in self.sessions.items()
            if now - data["last_activity"] > max_age_seconds
        ]

        for session_id in stale_sessions:
            self.cleanup_session(session_id)

        return len(stale_sessions)


# Global session manager instance
session_manager = SessionManager()