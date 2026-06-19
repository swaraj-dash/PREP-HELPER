from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websockets"])

class ConnectionManager:
    """Manages WebSocket connections per document ID to broadcast pipeline progress events."""
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, doc_id: str, websocket: WebSocket):
        await websocket.accept()
        if doc_id not in self.active_connections:
            self.active_connections[doc_id] = []
        self.active_connections[doc_id].append(websocket)
        print(f"[WebSocket] Connected client for doc_id: {doc_id}")

    def disconnect(self, doc_id: str, websocket: WebSocket):
        if doc_id in self.active_connections:
            if websocket in self.active_connections[doc_id]:
                self.active_connections[doc_id].remove(websocket)
            if not self.active_connections[doc_id]:
                del self.active_connections[doc_id]
        print(f"[WebSocket] Disconnected client for doc_id: {doc_id}")

    async def send_event(self, doc_id: str, event: dict):
        """Sends a JSON event payload to all clients listening to a specific document ID."""
        if doc_id in self.active_connections:
            for connection in self.active_connections[doc_id]:
                try:
                    await connection.send_json(event)
                except Exception as e:
                    # Ignore failures (e.g. client dropped connection mid-flight)
                    print(f"[WebSocket] Event dispatch failed: {e}")

manager = ConnectionManager()

@router.websocket("/ws/pipeline/{doc_id}")
async def websocket_endpoint(websocket: WebSocket, doc_id: str):
    await manager.connect(doc_id, websocket)
    try:
        while True:
            # Maintain active connection state
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(doc_id, websocket)
    except Exception:
        manager.disconnect(doc_id, websocket)
