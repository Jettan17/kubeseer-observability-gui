//! WebSocket server for real-time bidirectional communication.
//!
//! Handles WebSocket upgrades, subscription management, and broadcasting
//! resource graph patches to connected clients.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;

/// Client → Server messages.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    Subscribe {
        channel: String,
        #[serde(default)]
        params: serde_json::Value,
    },
    Unsubscribe {
        channel: String,
    },
    Ping,
}

/// Server → Client messages.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    Snapshot {
        channel: String,
        data: serde_json::Value,
    },
    Patch {
        channel: String,
        patches: Vec<serde_json::Value>,
    },
    LogBatch {
        subscription_id: String,
        lines: Vec<serde_json::Value>,
    },
    Error {
        code: String,
        message: String,
    },
    Pong,
    Connected {
        session_id: String,
    },
}

/// Type alias for the async snapshot function.
type SnapshotFn = Arc<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Vec<crate::cluster::resource_graph::ResourceNode>> + Send>> + Send + Sync>;

/// Shared state for WebSocket connections.
#[derive(Clone)]
pub struct WsState {
    pub patch_rx_factory: Arc<dyn Fn() -> broadcast::Receiver<crate::cluster::resource_graph::GraphPatch> + Send + Sync>,
    pub snapshot_fn: SnapshotFn,
}

/// Handle WebSocket upgrade requests.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(handle_socket)
}

/// Handle a connected WebSocket session.
async fn handle_socket(mut socket: WebSocket) {
    // Send connected message
    let connected = ServerMessage::Connected {
        session_id: uuid::Uuid::new_v4().to_string(),
    };
    if let Ok(msg) = serde_json::to_string(&connected) {
        let _ = socket.send(Message::Text(msg)).await;
    }

    // Main message loop
    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_msg {
                                ClientMessage::Ping => {
                                    let pong = serde_json::to_string(&ServerMessage::Pong).unwrap();
                                    if socket.send(Message::Text(pong)).await.is_err() {
                                        break;
                                    }
                                }
                                ClientMessage::Subscribe { channel, params: _ } => {
                                    // Acknowledge subscription
                                    let ack = ServerMessage::Snapshot {
                                        channel: channel.clone(),
                                        data: serde_json::json!({ "status": "subscribed" }),
                                    };
                                    if let Ok(msg) = serde_json::to_string(&ack) {
                                        if socket.send(Message::Text(msg)).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                                ClientMessage::Unsubscribe { channel: _ } => {
                                    // Acknowledge unsubscription
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {} // Ignore binary, ping, pong frames
                }
            }
        }
    }

    tracing::debug!("WebSocket connection closed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_ping() {
        let msg: ClientMessage = serde_json::from_str(r#"{"type":"ping"}"#).unwrap();
        assert!(matches!(msg, ClientMessage::Ping));
    }

    #[test]
    fn test_deserialize_subscribe() {
        let msg: ClientMessage = serde_json::from_str(
            r#"{"type":"subscribe","channel":"topology","params":{}}"#,
        )
        .unwrap();
        assert!(matches!(msg, ClientMessage::Subscribe { channel, .. } if channel == "topology"));
    }

    #[test]
    fn test_deserialize_unsubscribe() {
        let msg: ClientMessage =
            serde_json::from_str(r#"{"type":"unsubscribe","channel":"logs"}"#).unwrap();
        assert!(matches!(msg, ClientMessage::Unsubscribe { channel } if channel == "logs"));
    }

    #[test]
    fn test_serialize_pong() {
        let msg = ServerMessage::Pong;
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("pong"));
    }

    #[test]
    fn test_serialize_snapshot() {
        let msg = ServerMessage::Snapshot {
            channel: "topology".to_string(),
            data: serde_json::json!({"nodes": []}),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("topology"));
        assert!(json.contains("snapshot"));
    }

    #[test]
    fn test_serialize_error() {
        let msg = ServerMessage::Error {
            code: "AUTH_FAILED".to_string(),
            message: "Invalid token".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("AUTH_FAILED"));
    }
}
