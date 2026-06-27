//! REST API endpoints for programmatic access.
//!
//! Provides endpoints for contexts, resources, logs, metrics, and traces.
//! All endpoints are protected by the Auth_Module in shared mode.

use axum::{
    extract::{Path, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

/// Response for /api/v1/contexts
#[derive(Serialize)]
pub struct ContextsResponse {
    pub contexts: Vec<ContextInfo>,
    pub current: Option<String>,
}

#[derive(Serialize)]
pub struct ContextInfo {
    pub name: String,
    pub cluster_url: String,
    pub namespace: Option<String>,
    pub connected: bool,
}

/// Query params for log retrieval
#[derive(Deserialize)]
pub struct LogQuery {
    pub since: Option<String>,
    pub tail: Option<u64>,
    pub container: Option<String>,
}

/// Query params for metrics retrieval
#[derive(Deserialize)]
pub struct MetricsQuery {
    pub window: Option<String>,
}

/// Query params for trace search
#[derive(Deserialize)]
pub struct TraceQuery {
    pub service: Option<String>,
    pub min_duration: Option<f64>,
    pub status: Option<String>,
    pub limit: Option<u32>,
}

/// GET /api/v1/contexts - list available cluster contexts
pub async fn list_contexts() -> Json<ContextsResponse> {
    // TODO: Wire up to ClusterManager
    Json(ContextsResponse {
        contexts: vec![],
        current: None,
    })
}

/// POST /api/v1/contexts/:name/connect - connect to a cluster
pub async fn connect_context(
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Wire up to ClusterManager
    Ok(Json(serde_json::json!({
        "status": "connected",
        "context": name,
    })))
}

/// GET /api/v1/clusters/:id/resources - get resource graph snapshot
pub async fn get_resources(
    Path(_id): Path<String>,
) -> Json<serde_json::Value> {
    // TODO: Wire up to ResourceWatcher
    Json(serde_json::json!({
        "resources": [],
        "health": {
            "healthy": 0,
            "warning": 0,
            "critical": 0,
            "unknown": 0,
        }
    }))
}

/// GET /api/v1/clusters/:id/pods/:ns/:name/logs - get pod logs
pub async fn get_pod_logs(
    Path((_id, _ns, _name)): Path<(String, String, String)>,
    Query(_query): Query<LogQuery>,
) -> Json<serde_json::Value> {
    // TODO: Wire up to log streaming
    Json(serde_json::json!({
        "lines": []
    }))
}

/// GET /api/v1/clusters/:id/metrics/:resource_type/:ns/:name - get metrics
pub async fn get_metrics(
    Path((_id, _resource_type, _ns, _name)): Path<(String, String, String, String)>,
    Query(_query): Query<MetricsQuery>,
) -> Json<serde_json::Value> {
    // TODO: Wire up to metrics collection
    Json(serde_json::json!({
        "series": []
    }))
}

/// GET /api/v1/clusters/:id/traces - query traces
pub async fn get_traces(
    Path(_id): Path<String>,
    Query(_query): Query<TraceQuery>,
) -> Json<serde_json::Value> {
    // TODO: Wire up to trace backend
    Json(serde_json::json!({
        "traces": []
    }))
}

/// GET /api/v1/clusters/:id/traces/:trace_id - get trace detail
pub async fn get_trace_detail(
    Path((_id, _trace_id)): Path<(String, String)>,
) -> Json<serde_json::Value> {
    // TODO: Wire up to trace backend
    Json(serde_json::json!({
        "spans": []
    }))
}

/// POST /api/v1/export/logs - export logs
pub async fn export_logs() -> Json<serde_json::Value> {
    // TODO: Implement log export
    Json(serde_json::json!({
        "status": "not_implemented"
    }))
}

/// POST /api/v1/export/metrics - export metrics
pub async fn export_metrics() -> Json<serde_json::Value> {
    // TODO: Implement metrics export
    Json(serde_json::json!({
        "status": "not_implemented"
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_contexts_response() {
        let response = list_contexts().await;
        assert!(response.contexts.is_empty());
    }

    #[tokio::test]
    async fn test_connect_context_response() {
        let result = connect_context(Path("test-ctx".to_string())).await;
        assert!(result.is_ok());
        let json = result.unwrap();
        assert_eq!(json.0["context"], "test-ctx");
    }
}
