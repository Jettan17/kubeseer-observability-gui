//! Cluster connection management and resource graph.
//!
//! Handles multi-cluster connections, Kubernetes watch streams,
//! and the in-memory resource graph that powers the topology view.

pub mod connection;
pub mod resource_graph;
pub mod watcher;
