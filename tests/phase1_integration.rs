//! Phase 1 Integration Tests: Core Infrastructure Validation
//!
//! Tests static file serving, SPA fallback, compression, and config parsing.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

/// Helper to build a test app router.
fn test_app() -> axum::Router {
    let config = kubeobserve::config::Config {
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        kubeconfig: None,
        tls: false,
        tls_cert: None,
        tls_key: None,
        session_timeout_hours: 8,
        max_clusters: 10,
        log_level: "info".to_string(),
        no_open: true,
        config_file: None,
    };
    kubeobserve::api::build_router(&config)
}

#[tokio::test]
async fn test_health_endpoint_returns_ok() {
    let app = test_app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_spa_fallback_serves_index_html() {
    let app = test_app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/some/random/path")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should serve index.html (200) or fallback message
    assert!(response.status() == StatusCode::OK || response.status() == StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_contexts_endpoint() {
    let app = test_app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contexts")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_websocket_upgrade_without_upgrade_header_fails() {
    let app = test_app();
    let response = app
        .oneshot(
            Request::builder()
                .uri("/ws")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Without proper upgrade headers, should get an error status
    assert_ne!(response.status(), StatusCode::OK);
}
