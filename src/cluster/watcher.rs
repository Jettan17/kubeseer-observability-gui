//! Kubernetes watch streams using kube-rs informer pattern.
//!
//! Establishes watch streams for pods, deployments, services, nodes,
//! namespaces, and events. Streams are automatically reconnected on disconnect.

use crate::cluster::resource_graph::{
    GraphPatch, HealthStatus, ResourceGraph, ResourceKind, ResourceNode,
};
use futures_util::StreamExt;
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Node, Pod, Service};
use kube::runtime::watcher;
use kube::{Api, Client, Resource};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// Capacity of the broadcast channel for graph patches.
const BROADCAST_CAPACITY: usize = 1024;

/// Manages watch streams and broadcasts resource graph updates.
pub struct ResourceWatcher {
    graph: Arc<RwLock<ResourceGraph>>,
    patch_tx: broadcast::Sender<GraphPatch>,
}

impl ResourceWatcher {
    pub fn new() -> Self {
        let (patch_tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            graph: Arc::new(RwLock::new(ResourceGraph::new())),
            patch_tx,
        }
    }

    /// Subscribe to graph patch updates.
    pub fn subscribe(&self) -> broadcast::Receiver<GraphPatch> {
        self.patch_tx.subscribe()
    }

    /// Get a snapshot of the current resource graph.
    pub async fn snapshot(&self) -> Vec<ResourceNode> {
        let graph = self.graph.read().await;
        graph.snapshot().into_iter().cloned().collect()
    }

    /// Get the graph reference for reading.
    pub fn graph(&self) -> Arc<RwLock<ResourceGraph>> {
        self.graph.clone()
    }

    /// Start watching pods in a namespace (or all namespaces if None).
    pub fn watch_pods(&self, client: Client, namespace: Option<&str>) {
        let graph = self.graph.clone();
        let tx = self.patch_tx.clone();

        let api: Api<Pod> = match namespace {
            Some(ns) => Api::namespaced(client, ns),
            None => Api::all(client),
        };

        tokio::spawn(async move {
            let stream = watcher::watcher(api, watcher::Config::default());
            futures_util::pin_mut!(stream);

            while let Some(event) = stream.next().await {
                match event {
                    Ok(watcher::Event::Apply(pod)) | Ok(watcher::Event::InitApply(pod)) => {
                        if let Some(node) = pod_to_resource_node(&pod) {
                            let mut g = graph.write().await;
                            let patch = g.upsert(node);
                            let _ = tx.send(patch);
                        }
                    }
                    Ok(watcher::Event::Delete(pod)) => {
                        if let Some(uid) = pod.meta().uid.as_ref() {
                            let mut g = graph.write().await;
                            if let Some(patch) = g.remove(uid) {
                                let _ = tx.send(patch);
                            }
                        }
                    }
                    Ok(watcher::Event::Init) | Ok(watcher::Event::InitDone) => {}
                    Err(e) => {
                        tracing::warn!("Pod watch error: {}", e);
                    }
                }
            }
            tracing::warn!("Pod watch stream ended");
        });
    }

    /// Start watching deployments.
    pub fn watch_deployments(&self, client: Client, namespace: Option<&str>) {
        let graph = self.graph.clone();
        let tx = self.patch_tx.clone();

        let api: Api<Deployment> = match namespace {
            Some(ns) => Api::namespaced(client, ns),
            None => Api::all(client),
        };

        tokio::spawn(async move {
            let stream = watcher::watcher(api, watcher::Config::default());
            futures_util::pin_mut!(stream);

            while let Some(event) = stream.next().await {
                match event {
                    Ok(watcher::Event::Apply(deploy)) | Ok(watcher::Event::InitApply(deploy)) => {
                        if let Some(node) = deployment_to_resource_node(&deploy) {
                            let mut g = graph.write().await;
                            let patch = g.upsert(node);
                            let _ = tx.send(patch);
                        }
                    }
                    Ok(watcher::Event::Delete(deploy)) => {
                        if let Some(uid) = deploy.meta().uid.as_ref() {
                            let mut g = graph.write().await;
                            if let Some(patch) = g.remove(uid) {
                                let _ = tx.send(patch);
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("Deployment watch error: {}", e);
                    }
                }
            }
        });
    }

    /// Start watching services.
    pub fn watch_services(&self, client: Client, namespace: Option<&str>) {
        let graph = self.graph.clone();
        let tx = self.patch_tx.clone();

        let api: Api<Service> = match namespace {
            Some(ns) => Api::namespaced(client, ns),
            None => Api::all(client),
        };

        tokio::spawn(async move {
            let stream = watcher::watcher(api, watcher::Config::default());
            futures_util::pin_mut!(stream);

            while let Some(event) = stream.next().await {
                match event {
                    Ok(watcher::Event::Apply(svc)) | Ok(watcher::Event::InitApply(svc)) => {
                        if let Some(node) = service_to_resource_node(&svc) {
                            let mut g = graph.write().await;
                            let patch = g.upsert(node);
                            let _ = tx.send(patch);
                        }
                    }
                    Ok(watcher::Event::Delete(svc)) => {
                        if let Some(uid) = svc.meta().uid.as_ref() {
                            let mut g = graph.write().await;
                            if let Some(patch) = g.remove(uid) {
                                let _ = tx.send(patch);
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("Service watch error: {}", e);
                    }
                }
            }
        });
    }

    /// Start watching nodes.
    pub fn watch_nodes(&self, client: Client) {
        let graph = self.graph.clone();
        let tx = self.patch_tx.clone();
        let api: Api<Node> = Api::all(client);

        tokio::spawn(async move {
            let stream = watcher::watcher(api, watcher::Config::default());
            futures_util::pin_mut!(stream);

            while let Some(event) = stream.next().await {
                match event {
                    Ok(watcher::Event::Apply(node)) | Ok(watcher::Event::InitApply(node)) => {
                        if let Some(rn) = k8s_node_to_resource_node(&node) {
                            let mut g = graph.write().await;
                            let patch = g.upsert(rn);
                            let _ = tx.send(patch);
                        }
                    }
                    Ok(watcher::Event::Delete(node)) => {
                        if let Some(uid) = node.meta().uid.as_ref() {
                            let mut g = graph.write().await;
                            if let Some(patch) = g.remove(uid) {
                                let _ = tx.send(patch);
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("Node watch error: {}", e);
                    }
                }
            }
        });
    }
}

/// Convert a Pod into a ResourceNode.
fn pod_to_resource_node(pod: &Pod) -> Option<ResourceNode> {
    let meta = pod.meta();
    let uid = meta.uid.as_ref()?;
    let name = meta.name.as_ref()?;

    let status = pod
        .status
        .as_ref()
        .and_then(|s| s.phase.as_ref())
        .map(|phase| match phase.as_str() {
            "Running" | "Succeeded" => HealthStatus::Healthy,
            "Pending" => HealthStatus::Warning {
                message: "Pod is pending".to_string(),
            },
            "Failed" => HealthStatus::Critical {
                message: "Pod has failed".to_string(),
            },
            _ => HealthStatus::Unknown,
        })
        .unwrap_or(HealthStatus::Unknown);

    // Detect CrashLoopBackOff
    let status = if let Some(pod_status) = &pod.status {
        if let Some(container_statuses) = &pod_status.container_statuses {
            let crash_loop = container_statuses.iter().any(|cs| {
                cs.state
                    .as_ref()
                    .and_then(|s| s.waiting.as_ref())
                    .and_then(|w| w.reason.as_ref())
                    .map(|r| r == "CrashLoopBackOff")
                    .unwrap_or(false)
            });
            if crash_loop {
                HealthStatus::Critical {
                    message: "CrashLoopBackOff".to_string(),
                }
            } else {
                status
            }
        } else {
            status
        }
    } else {
        status
    };

    let restart_count = pod
        .status
        .as_ref()
        .and_then(|s| s.container_statuses.as_ref())
        .map(|cs| cs.iter().map(|c| c.restart_count as u32).sum())
        .unwrap_or(0);

    let parent_uid = meta
        .owner_references
        .as_ref()
        .and_then(|refs| refs.first())
        .and_then(|r| Some(r.uid.clone()));

    Some(ResourceNode {
        uid: uid.clone(),
        kind: ResourceKind::Pod,
        name: name.clone(),
        namespace: meta.namespace.clone(),
        status,
        labels: meta.labels.clone().unwrap_or_default(),
        annotations: meta.annotations.clone().unwrap_or_default(),
        metrics: None,
        parent_uid,
        age_seconds: meta.creation_timestamp.as_ref().map(|ts| {
            let now = chrono::Utc::now();
            (now - ts.0).num_seconds().max(0) as u64
        }),
        restart_count: Some(restart_count),
    })
}

/// Convert a Deployment into a ResourceNode.
fn deployment_to_resource_node(deploy: &Deployment) -> Option<ResourceNode> {
    let meta = deploy.meta();
    let uid = meta.uid.as_ref()?;
    let name = meta.name.as_ref()?;

    let status = deploy
        .status
        .as_ref()
        .map(|s| {
            let desired = s.replicas.unwrap_or(0);
            let ready = s.ready_replicas.unwrap_or(0);
            if ready < desired {
                HealthStatus::Warning {
                    message: format!("{}/{} replicas ready", ready, desired),
                }
            } else {
                HealthStatus::Healthy
            }
        })
        .unwrap_or(HealthStatus::Unknown);

    Some(ResourceNode {
        uid: uid.clone(),
        kind: ResourceKind::Deployment,
        name: name.clone(),
        namespace: meta.namespace.clone(),
        status,
        labels: meta.labels.clone().unwrap_or_default(),
        annotations: meta.annotations.clone().unwrap_or_default(),
        metrics: None,
        parent_uid: None,
        age_seconds: None,
        restart_count: None,
    })
}

/// Convert a Service into a ResourceNode.
fn service_to_resource_node(svc: &Service) -> Option<ResourceNode> {
    let meta = svc.meta();
    let uid = meta.uid.as_ref()?;
    let name = meta.name.as_ref()?;

    Some(ResourceNode {
        uid: uid.clone(),
        kind: ResourceKind::Service,
        name: name.clone(),
        namespace: meta.namespace.clone(),
        status: HealthStatus::Healthy,
        labels: meta.labels.clone().unwrap_or_default(),
        annotations: meta.annotations.clone().unwrap_or_default(),
        metrics: None,
        parent_uid: None,
        age_seconds: None,
        restart_count: None,
    })
}

/// Convert a K8s Node into a ResourceNode.
fn k8s_node_to_resource_node(node: &Node) -> Option<ResourceNode> {
    let meta = node.meta();
    let uid = meta.uid.as_ref()?;
    let name = meta.name.as_ref()?;

    let status = node
        .status
        .as_ref()
        .and_then(|s| s.conditions.as_ref())
        .map(|conditions| {
            let pressure = conditions.iter().any(|c| {
                (c.type_ == "MemoryPressure" || c.type_ == "DiskPressure")
                    && c.status == "True"
            });
            let ready = conditions
                .iter()
                .any(|c| c.type_ == "Ready" && c.status == "True");

            if pressure {
                HealthStatus::Warning {
                    message: "Node under pressure".to_string(),
                }
            } else if !ready {
                HealthStatus::Critical {
                    message: "Node not ready".to_string(),
                }
            } else {
                HealthStatus::Healthy
            }
        })
        .unwrap_or(HealthStatus::Unknown);

    Some(ResourceNode {
        uid: uid.clone(),
        kind: ResourceKind::Node,
        name: name.clone(),
        namespace: None,
        status,
        labels: meta.labels.clone().unwrap_or_default(),
        annotations: meta.annotations.clone().unwrap_or_default(),
        metrics: None,
        parent_uid: None,
        age_seconds: None,
        restart_count: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_watcher_creation() {
        let watcher = ResourceWatcher::new();
        let _rx = watcher.subscribe();
    }

    #[tokio::test]
    async fn test_snapshot_empty() {
        let watcher = ResourceWatcher::new();
        let snapshot = watcher.snapshot().await;
        assert!(snapshot.is_empty());
    }
}
