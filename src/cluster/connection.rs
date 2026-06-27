//! Cluster connection management.
//!
//! Handles connecting to Kubernetes clusters, managing multiple
//! simultaneous connections, and verifying RBAC permissions.

use anyhow::{Context, Result};
use kube::{config::Kubeconfig as KubeKubeconfig, Client, Config};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Unique identifier for a cluster connection.
pub type ClusterId = String;

/// Status of a cluster connection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

/// A single managed cluster connection.
#[derive(Clone)]
pub struct ClusterConnection {
    pub id: ClusterId,
    pub context_name: String,
    pub cluster_url: String,
    pub namespace: Option<String>,
    pub status: ConnectionStatus,
    pub client: Option<Client>,
}

impl std::fmt::Debug for ClusterConnection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClusterConnection")
            .field("id", &self.id)
            .field("context_name", &self.context_name)
            .field("cluster_url", &self.cluster_url)
            .field("namespace", &self.namespace)
            .field("status", &self.status)
            .field("client", &self.client.is_some())
            .finish()
    }
}

/// Manages multiple cluster connections.
#[derive(Debug, Clone)]
pub struct ClusterManager {
    connections: Arc<RwLock<HashMap<ClusterId, ClusterConnection>>>,
    max_clusters: usize,
}

impl ClusterManager {
    pub fn new(max_clusters: usize) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            max_clusters,
        }
    }

    /// Connect to a cluster by context name.
    /// Uses the system kubeconfig to establish the connection.
    pub async fn connect(&self, context_name: &str) -> Result<ClusterId> {
        let connections = self.connections.read().await;
        if connections.len() >= self.max_clusters {
            anyhow::bail!(
                "Maximum cluster connections ({}) reached. Disconnect a cluster first.",
                self.max_clusters
            );
        }

        // Check if already connected
        if let Some(existing) = connections
            .values()
            .find(|c| c.context_name == context_name)
        {
            if existing.status == ConnectionStatus::Connected {
                return Ok(existing.id.clone());
            }
        }
        drop(connections);

        let id = format!("cluster-{}", uuid::Uuid::new_v4());

        // Update status to connecting
        {
            let mut connections = self.connections.write().await;
            connections.insert(
                id.clone(),
                ClusterConnection {
                    id: id.clone(),
                    context_name: context_name.to_string(),
                    cluster_url: String::new(),
                    namespace: None,
                    status: ConnectionStatus::Connecting,
                    client: None,
                },
            );
        }

        // Build kube client from kubeconfig context
        match build_client(context_name).await {
            Ok((client, config_info)) => {
                let mut connections = self.connections.write().await;
                if let Some(conn) = connections.get_mut(&id) {
                    conn.client = Some(client);
                    conn.cluster_url = config_info.cluster_url;
                    conn.namespace = config_info.default_namespace;
                    conn.status = ConnectionStatus::Connected;
                }
                tracing::info!("Connected to cluster context: {}", context_name);
                Ok(id)
            }
            Err(e) => {
                let mut connections = self.connections.write().await;
                if let Some(conn) = connections.get_mut(&id) {
                    conn.status = ConnectionStatus::Error(e.to_string());
                }
                Err(e)
            }
        }
    }

    /// Disconnect from a cluster.
    pub async fn disconnect(&self, cluster_id: &str) -> bool {
        let mut connections = self.connections.write().await;
        connections.remove(cluster_id).is_some()
    }

    /// Get a client for a connected cluster.
    pub async fn get_client(&self, cluster_id: &str) -> Option<Client> {
        let connections = self.connections.read().await;
        connections
            .get(cluster_id)
            .and_then(|c| c.client.clone())
    }

    /// List all connections and their statuses.
    pub async fn list_connections(&self) -> Vec<ClusterConnection> {
        let connections = self.connections.read().await;
        connections.values().cloned().collect()
    }

    /// Number of active connections.
    pub async fn active_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections
            .values()
            .filter(|c| c.status == ConnectionStatus::Connected)
            .count()
    }
}

/// Info extracted from kube config during connection.
struct ConfigInfo {
    cluster_url: String,
    default_namespace: Option<String>,
}

/// Build a kube::Client from a specific kubeconfig context.
async fn build_client(context_name: &str) -> Result<(Client, ConfigInfo)> {
    let kubeconfig = KubeKubeconfig::read()
        .context("Failed to read kubeconfig")?;

    let config = Config::from_custom_kubeconfig(kubeconfig.clone(), &kube::config::KubeConfigOptions {
        context: Some(context_name.to_string()),
        cluster: None,
        user: None,
    })
    .await
    .with_context(|| format!("Failed to build config for context '{}'", context_name))?;

    let cluster_url = config.cluster_url.to_string();
    let default_namespace = config.default_namespace.clone();

    let client = Client::try_from(config)
        .with_context(|| format!("Failed to create client for context '{}'", context_name))?;

    Ok((
        client,
        ConfigInfo {
            cluster_url,
            default_namespace: Some(default_namespace),
        },
    ))
}

/// Verify minimum RBAC permissions for observability.
/// Returns a list of permissions that are NOT available.
pub async fn verify_rbac(client: &Client) -> Vec<String> {
    use k8s_openapi::api::authorization::v1::{
        SelfSubjectAccessReview, SelfSubjectAccessReviewSpec, ResourceAttributes,
    };
    use kube::api::PostParams;
    use kube::Api;

    let checks = vec![
        ("", "pods", "list"),
        ("", "pods", "get"),
        ("", "nodes", "list"),
        ("", "events", "list"),
        ("apps", "deployments", "list"),
        ("", "services", "list"),
        ("", "namespaces", "list"),
    ];

    let api: Api<SelfSubjectAccessReview> = Api::all(client.clone());
    let mut missing = vec![];

    for (group, resource, verb) in checks {
        let review = SelfSubjectAccessReview {
            metadata: Default::default(),
            spec: SelfSubjectAccessReviewSpec {
                resource_attributes: Some(ResourceAttributes {
                    group: Some(group.to_string()),
                    resource: Some(resource.to_string()),
                    verb: Some(verb.to_string()),
                    ..Default::default()
                }),
                non_resource_attributes: None,
            },
            status: None,
        };

        match api.create(&PostParams::default(), &review).await {
            Ok(result) => {
                if let Some(status) = result.status {
                    if !status.allowed {
                        missing.push(format!("{}/{} {}", group, resource, verb));
                    }
                }
            }
            Err(_) => {
                // If we can't even check, assume it's missing
                missing.push(format!("{}/{} {}", group, resource, verb));
            }
        }
    }

    missing
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cluster_manager_creation() {
        let manager = ClusterManager::new(10);
        assert_eq!(manager.active_count().await, 0);
    }

    #[tokio::test]
    async fn test_disconnect_nonexistent() {
        let manager = ClusterManager::new(10);
        assert!(!manager.disconnect("nonexistent").await);
    }

    #[tokio::test]
    async fn test_list_empty() {
        let manager = ClusterManager::new(10);
        assert!(manager.list_connections().await.is_empty());
    }
}
