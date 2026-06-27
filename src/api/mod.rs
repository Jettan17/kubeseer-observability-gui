mod static_files;
pub mod rest;
pub mod websocket;

use crate::config::Config;
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::trace::TraceLayer;

/// Build the main application router.
pub fn build_router(_config: &Config) -> Router {
    let api_routes = Router::new()
        .route("/api/v1/health", axum::routing::get(health_check))
        .route("/api/v1/contexts", axum::routing::get(rest::list_contexts))
        .route("/api/v1/contexts/{name}/connect", axum::routing::post(rest::connect_context))
        .route("/api/v1/clusters/{id}/resources", axum::routing::get(rest::get_resources))
        .route("/api/v1/clusters/{id}/pods/{ns}/{name}/logs", axum::routing::get(rest::get_pod_logs))
        .route("/api/v1/clusters/{id}/metrics/{resource_type}/{ns}/{name}", axum::routing::get(rest::get_metrics))
        .route("/api/v1/clusters/{id}/traces", axum::routing::get(rest::get_traces))
        .route("/api/v1/clusters/{id}/traces/{trace_id}", axum::routing::get(rest::get_trace_detail))
        .route("/api/v1/export/logs", axum::routing::post(rest::export_logs))
        .route("/api/v1/export/metrics", axum::routing::post(rest::export_metrics))
        .route("/ws", axum::routing::get(websocket::ws_handler));

    Router::new()
        .merge(api_routes)
        .fallback(static_files::static_handler)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn test_config() -> Config {
        Config {
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
        }
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = build_router(&test_config());
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
}
