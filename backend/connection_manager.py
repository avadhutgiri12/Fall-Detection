"""
Connection Manager for WebSocket connections.
Handles connection pooling, limiting, and per-connection state.
"""

import asyncio
import time
import uuid
from typing import Dict, Optional, Any
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections with max limit and per-connection state."""

    def __init__(self, max_connections: int = 10):
        self.max_connections = max_connections
        self.active_connections: Dict[str, WebSocket] = {}  # connection_id -> WebSocket
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}  # connection_id -> metadata
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, connection_id: Optional[str] = None) -> tuple[bool, str]:
        """
        Accept a new WebSocket connection.

        Returns:
            tuple: (success: bool, connection_id: str)
        """
        async with self._lock:
            if len(self.active_connections) >= self.max_connections:
                return False, ""

            if connection_id is None:
                connection_id = str(uuid.uuid4())[:8]

            # Ensure unique connection_id
            while connection_id in self.active_connections:
                connection_id = str(uuid.uuid4())[:8]

            self.active_connections[connection_id] = websocket
            self.connection_metadata[connection_id] = {
                "connected_at": time.time(),
                "conf_threshold": 0.6,
                "frames_sent": 0,
                "frames_received": 0,
                "last_activity": time.time(),
            }
            return True, connection_id

    def disconnect(self, connection_id: str) -> bool:
        """Disconnect and remove a connection."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.connection_metadata:
            del self.connection_metadata[connection_id]
        return True

    def get_connection(self, connection_id: str) -> Optional[WebSocket]:
        """Get WebSocket by connection ID."""
        return self.active_connections.get(connection_id)

    def update_metadata(self, connection_id: str, **kwargs) -> bool:
        """Update connection metadata."""
        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id].update(kwargs)
            self.connection_metadata[connection_id]["last_activity"] = time.time()
            return True
        return False

    def get_metadata(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get connection metadata."""
        return self.connection_metadata.get(connection_id)

    def get_all_metadata(self) -> Dict[str, Dict[str, Any]]:
        """Get metadata for all active connections."""
        return self.connection_metadata.copy()

    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "active": len(self.active_connections),
            "max": self.max_connections,
            "available": self.max_connections - len(self.active_connections),
            "connections": list(self.connection_metadata.keys()),
        }

    async def broadcast(self, message: Dict[str, Any], exclude: Optional[str] = None) -> int:
        """Broadcast message to all connected clients."""
        sent = 0
        for conn_id, ws in self.active_connections.items():
            if conn_id != exclude:
                try:
                    await ws.send_json(message)
                    sent += 1
                except Exception:
                    pass
        return sent


# Global connection manager instance
connection_manager = ConnectionManager(max_connections=10)