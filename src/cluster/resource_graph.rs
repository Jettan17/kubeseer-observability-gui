//! In-memory resource relationship graph.
//!
//! Maintains a live view of all Kubernetes resources and their relationships
//! (ownership, label selection, networking). Updated via watch streams and
//! diffed to produce JSON patches for connected frontends.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Kinds of Kubernetes resources tracked in the graph.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ResourceKind {
    Node,
    Namespace,
    Deployment,
    ReplicaSet,
    StatefulSet,
    DaemonSet,
    Service,
    Pod,
    Container,
    Crd(String),
}

/// Health status of a resource.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum HealthStatus {
    Healthy,
    Warning { message: String },
    Critical { message: String },
    Unknown,
}

/// Metrics snapshot for a resource.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceMetrics {
    pub cpu_usage_millicores: u64,
    pub cpu_limit_millicores: Option<u64>,
    pub memory_usage_bytes: u64,
    pub memory_limit_bytes: Option<u64>,
}

/// A node in the resource graph representing a single Kubernetes resource.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceNode {
    pub uid: String,
    pub kind: ResourceKind,
    pub name: String,
    pub namespace: Option<String>,
    pub status: HealthStatus,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
    pub metrics: Option<ResourceMetrics>,
    pub parent_uid: Option<String>,
    pub age_seconds: Option<u64>,
    pub restart_count: Option<u32>,
}

/// An operation applied to the resource graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "op")]
pub enum GraphPatch {
    Add { resource: ResourceNode },
    Update { resource: ResourceNode },
    Remove { uid: String },
}

/// The in-memory resource graph.
#[derive(Debug, Default)]
pub struct ResourceGraph {
    nodes: HashMap<String, ResourceNode>,
}

impl ResourceGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    /// Apply a patch to the graph.
    pub fn apply_patch(&mut self, patch: &GraphPatch) {
        match patch {
            GraphPatch::Add { resource } | GraphPatch::Update { resource } => {
                self.nodes.insert(resource.uid.clone(), resource.clone());
            }
            GraphPatch::Remove { uid } => {
                self.nodes.remove(uid);
            }
        }
    }

    /// Add or update a resource in the graph.
    pub fn upsert(&mut self, resource: ResourceNode) -> GraphPatch {
        let patch = if self.nodes.contains_key(&resource.uid) {
            GraphPatch::Update {
                resource: resource.clone(),
            }
        } else {
            GraphPatch::Add {
                resource: resource.clone(),
            }
        };
        self.nodes.insert(resource.uid.clone(), resource);
        patch
    }

    /// Remove a resource by UID.
    pub fn remove(&mut self, uid: &str) -> Option<GraphPatch> {
        if self.nodes.remove(uid).is_some() {
            Some(GraphPatch::Remove {
                uid: uid.to_string(),
            })
        } else {
            None
        }
    }

    /// Get a resource by UID.
    pub fn get(&self, uid: &str) -> Option<&ResourceNode> {
        self.nodes.get(uid)
    }

    /// Get all resources as a snapshot.
    pub fn snapshot(&self) -> Vec<&ResourceNode> {
        self.nodes.values().collect()
    }

    /// Get count of resources.
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Whether the graph is empty.
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Get children of a resource (resources whose parent_uid matches).
    pub fn children_of(&self, uid: &str) -> Vec<&ResourceNode> {
        self.nodes
            .values()
            .filter(|n| n.parent_uid.as_deref() == Some(uid))
            .collect()
    }

    /// Check graph consistency: all parent references resolve.
    pub fn is_consistent(&self) -> bool {
        self.nodes.values().all(|node| {
            node.parent_uid
                .as_ref()
                .map(|pid| self.nodes.contains_key(pid))
                .unwrap_or(true)
        })
    }

    /// Get health summary counts.
    pub fn health_summary(&self) -> HealthSummary {
        let mut summary = HealthSummary::default();
        for node in self.nodes.values() {
            match &node.status {
                HealthStatus::Healthy => summary.healthy += 1,
                HealthStatus::Warning { .. } => summary.warning += 1,
                HealthStatus::Critical { .. } => summary.critical += 1,
                HealthStatus::Unknown => summary.unknown += 1,
            }
        }
        summary
    }
}

/// Aggregate health counts for a cluster.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct HealthSummary {
    pub healthy: usize,
    pub warning: usize,
    pub critical: usize,
    pub unknown: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_pod(uid: &str, name: &str, parent: Option<&str>) -> ResourceNode {
        ResourceNode {
            uid: uid.to_string(),
            kind: ResourceKind::Pod,
            name: name.to_string(),
            namespace: Some("default".to_string()),
            status: HealthStatus::Healthy,
            labels: HashMap::new(),
            annotations: HashMap::new(),
            metrics: None,
            parent_uid: parent.map(|s| s.to_string()),
            age_seconds: Some(120),
            restart_count: Some(0),
        }
    }

    #[test]
    fn test_upsert_and_get() {
        let mut graph = ResourceGraph::new();
        let pod = make_pod("pod-1", "nginx", None);
        graph.upsert(pod);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph.get("pod-1").unwrap().name, "nginx");
    }

    #[test]
    fn test_remove() {
        let mut graph = ResourceGraph::new();
        graph.upsert(make_pod("pod-1", "nginx", None));
        assert!(graph.remove("pod-1").is_some());
        assert_eq!(graph.len(), 0);
        assert!(graph.remove("pod-1").is_none());
    }

    #[test]
    fn test_children_of() {
        let mut graph = ResourceGraph::new();
        graph.upsert(ResourceNode {
            uid: "rs-1".to_string(),
            kind: ResourceKind::ReplicaSet,
            name: "nginx-rs".to_string(),
            namespace: Some("default".to_string()),
            status: HealthStatus::Healthy,
            labels: HashMap::new(),
            annotations: HashMap::new(),
            metrics: None,
            parent_uid: None,
            age_seconds: None,
            restart_count: None,
        });
        graph.upsert(make_pod("pod-1", "nginx-1", Some("rs-1")));
        graph.upsert(make_pod("pod-2", "nginx-2", Some("rs-1")));
        graph.upsert(make_pod("pod-3", "other", None));

        let children = graph.children_of("rs-1");
        assert_eq!(children.len(), 2);
    }

    #[test]
    fn test_consistency_check() {
        let mut graph = ResourceGraph::new();
        graph.upsert(make_pod("pod-1", "nginx", None));
        assert!(graph.is_consistent());

        // Add pod with non-existent parent
        graph.upsert(make_pod("pod-2", "broken", Some("nonexistent")));
        assert!(!graph.is_consistent());
    }

    #[test]
    fn test_health_summary() {
        let mut graph = ResourceGraph::new();
        graph.upsert(make_pod("pod-1", "healthy", None));
        graph.upsert(ResourceNode {
            uid: "pod-2".to_string(),
            kind: ResourceKind::Pod,
            name: "warning".to_string(),
            namespace: Some("default".to_string()),
            status: HealthStatus::Warning {
                message: "high memory".to_string(),
            },
            labels: HashMap::new(),
            annotations: HashMap::new(),
            metrics: None,
            parent_uid: None,
            age_seconds: None,
            restart_count: None,
        });

        let summary = graph.health_summary();
        assert_eq!(summary.healthy, 1);
        assert_eq!(summary.warning, 1);
    }
}
