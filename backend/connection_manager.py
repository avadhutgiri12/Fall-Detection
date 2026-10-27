"""
Connection Manager for WebSocket connections.

Handles:
- WebSocket connection limits
- Connection metadata
- Connection statistics
"""

import asyncio
import os
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import WebSocket


MAX_WEBSOCKET_CONNECTIONS = int(
    os.getenv("MAX_ACTIVE_SESSIONS", "5")
)


class ConnectionManager:
    """Manage WebSocket connections and their metadata."""

    def __init__(self, max_connections: int = 5):
        self.max_connections = max(1, max_connections)

        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}

        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: Optional[str] = None,
    ) -> tuple[bool, str]:
        """
        Register a WebSocket connection.

        Returns:
            (success, connection_id)
        """
        async with self._lock:
            if len(self.active_connections) >= self.max_connections:
                return False, ""

            connection_id = connection_id or str(uuid.uuid4())[:12]

            # Ensure the ID is unique.
            while connection_id in self.active_connections:
                connection_id = str(uuid.uuid4())[:12]

            self.active_connections[connection_id] = websocket

            self.connection_metadata[connection_id] = {
                "connected_at": time.time(),
                "last_activity": time.time(),
                "conf_threshold": 0.6,
                "frames_sent": 0,
                "frames_received": 0,
            }

            return True, connection_id

    async def disconnect(self, connection_id: str) -> bool:
        """Remove a connection and its metadata."""
        async with self._lock:
            existed = connection_id in self.active_connections

            self.active_connections.pop(connection_id, None)
            self.connection_metadata.pop(connection_id, None)

            return existed

    def get_connection(
        self,
        connection_id: str,
    ) -> Optional[WebSocket]:
        return self.active_connections.get(connection_id)

    def update_metadata(
        self,
        connection_id: str,
        **kwargs: Any,
    ) -> bool:
        """Update metadata for a connected client."""
        metadata = self.connection_metadata.get(connection_id)

        if metadata is None:
            return False

        metadata.update(kwargs)
        metadata["last_activity"] = time.time()

        return True

    def get_metadata(
        self,
        connection_id: str,
    ) -> Optional[Dict[str, Any]]:
        metadata = self.connection_metadata.get(connection_id)

        return dict(metadata) if metadata else None

    def get_all_metadata(self) -> Dict[str, Dict[str, Any]]:
        return {
            connection_id: dict(metadata)
            for connection_id, metadata in self.connection_metadata.items()
        }

    def get_stats(self) -> Dict[str, Any]:
        active = len(self.active_connections)

        return {
            "active": active,
            "max": self.max_connections,
            "available": max(0, self.max_connections - active),
            "connections": list(self.active_connections.keys()),
        }

    async def broadcast(
        self,
        message: Dict[str, Any],
        exclude: Optional[str] = None,
    ) -> int:
        """Broadcast a message to connected clients."""
        sent = 0

        for connection_id, websocket in list(
            self.active_connections.items()
        ):
            if connection_id == exclude:
                continue

            try:
                await websocket.send_json(message)
                sent += 1
            except Exception:
                # A disconnected client may still be in the snapshot.
                await self.disconnect(connection_id)

        return sent


connection_manager = ConnectionManager(
    max_connections=MAX_WEBSOCKET_CONNECTIONS
)