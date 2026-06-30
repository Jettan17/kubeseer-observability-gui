//! Phase 4 Test Suite: WebSocket and Real-Time Communication Validation
//!
//! Tests message protocol serialization, subscription management, and
//! WebSocket connection behavior.

use kubeobserve::api::websocket::{ClientMessage, ServerMessage};

// --- Message Serialization/Deserialization ---

#[test]
fn test_client_ping_deserialization() {
    let msg: ClientMessage = serde_json::from_str(r#"{"type":"ping"}"#).unwrap();
    assert!(matches!(msg, ClientMessage::Ping));
}

#[test]
fn test_client_subscribe_deserialization() {
    let msg: ClientMessage = serde_json::from_str(
        r#"{"type":"subscribe","channel":"topology","params":{"namespace":"default"}}"#,
    ).unwrap();
    match msg {
        ClientMessage::Subscribe { channel, params } => {
            assert_eq!(channel, "topology");
            assert_eq!(params["namespace"], "default");
        }
        _ => panic!("Expected Subscribe"),
    }
}

#[test]
fn test_client_subscribe_without_params() {
    let msg: ClientMessage = serde_json::from_str(
        r#"{"type":"subscribe","channel":"logs"}"#,
    ).unwrap();
    assert!(matches!(msg, ClientMessage::Subscribe { channel, .. } if channel == "logs"));
}

#[test]
fn test_client_unsubscribe_deserialization() {
    let msg: ClientMessage = serde_json::from_str(
        r#"{"type":"unsubscribe","channel":"metrics"}"#,
    ).unwrap();
    assert!(matches!(msg, ClientMessage::Unsubscribe { channel } if channel == "metrics"));
}

#[test]
fn test_invalid_message_type_fails() {
    let result: Result<ClientMessage, _> = serde_json::from_str(
        r#"{"type":"invalid_type","channel":"foo"}"#,
    );
    assert!(result.is_err());
}

#[test]
fn test_server_pong_serialization() {
    let msg = ServerMessage::Pong;
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "pong");
}

#[test]
fn test_server_snapshot_serialization() {
    let msg = ServerMessage::Snapshot {
        channel: "topology".to_string(),
        data: serde_json::json!({"resources": [{"uid": "pod-1", "name": "nginx"}]}),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "snapshot");
    assert_eq!(parsed["channel"], "topology");
    assert!(parsed["data"]["resources"].is_array());
}

#[test]
fn test_server_patch_serialization() {
    let msg = ServerMessage::Patch {
        channel: "topology".to_string(),
        patches: vec![
            serde_json::json!({"op": "add", "path": "/pod-2", "value": {"name": "redis"}}),
        ],
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "patch");
    assert_eq!(parsed["patches"].as_array().unwrap().len(), 1);
}

#[test]
fn test_server_error_serialization() {
    let msg = ServerMessage::Error {
        code: "UNAUTHORIZED".to_string(),
        message: "Session expired".to_string(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "error");
    assert_eq!(parsed["code"], "UNAUTHORIZED");
    assert_eq!(parsed["message"], "Session expired");
}

#[test]
fn test_server_connected_serialization() {
    let msg = ServerMessage::Connected {
        session_id: "abc-123".to_string(),
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "connected");
    // Field name follows serde rename_all on the enum
    let has_session_id = parsed.get("sessionId").or(parsed.get("session_id"));
    assert!(has_session_id.is_some(), "Expected session_id field in: {}", json);
    assert_eq!(has_session_id.unwrap(), "abc-123");
}

#[test]
fn test_server_log_batch_serialization() {
    let msg = ServerMessage::LogBatch {
        subscription_id: "sub-1".to_string(),
        lines: vec![
            serde_json::json!({"timestamp": "2024-01-01T00:00:00Z", "container": "app", "message": "started"}),
        ],
    };
    let json = serde_json::to_string(&msg).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "logBatch");
    let has_sub_id = parsed.get("subscriptionId").or(parsed.get("subscription_id"));
    assert!(has_sub_id.is_some(), "Expected subscription_id field in: {}", json);
    assert_eq!(has_sub_id.unwrap(), "sub-1");
    let lines = parsed.get("lines").expect("Expected lines field");
    assert_eq!(lines.as_array().unwrap().len(), 1);
}

// --- Stress test: message serialization throughput ---

#[test]
fn test_stress_serialize_1000_patches() {
    let start = std::time::Instant::now();

    for i in 0..1000 {
        let msg = ServerMessage::Patch {
            channel: "topology".to_string(),
            patches: vec![
                serde_json::json!({
                    "op": "replace",
                    "path": format!("/pod-{}", i),
                    "value": {"status": "running", "cpu": i * 10}
                }),
            ],
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(!json.is_empty());
    }

    let elapsed = start.elapsed();
    // 1000 serializations should take well under 100ms
    assert!(
        elapsed.as_millis() < 100,
        "1000 patch serializations took {}ms",
        elapsed.as_millis()
    );
}

#[test]
fn test_stress_deserialize_1000_subscribes() {
    let messages: Vec<String> = (0..1000)
        .map(|i| format!(r#"{{"type":"subscribe","channel":"logs","params":{{"pod":"pod-{}"}}}}"#, i))
        .collect();

    let start = std::time::Instant::now();

    for msg in &messages {
        let parsed: ClientMessage = serde_json::from_str(msg).unwrap();
        assert!(matches!(parsed, ClientMessage::Subscribe { .. }));
    }

    let elapsed = start.elapsed();
    assert!(
        elapsed.as_millis() < 100,
        "1000 deserializations took {}ms",
        elapsed.as_millis()
    );
}
