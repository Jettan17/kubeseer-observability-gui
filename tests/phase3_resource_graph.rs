//! Phase 3 Test Suite: Cluster Connection and Resource Graph Validation
//!
//! Tests resource graph operations, consistency properties, and performance.

use kubeseer::cluster::resource_graph::*;
use std::collections::BTreeMap;

fn make_node(uid: &str, name: &str, kind: ResourceKind, parent: Option<&str>) -> ResourceNode {
    ResourceNode {
        uid: uid.to_string(),
        kind,
        name: name.to_string(),
        namespace: Some("default".to_string()),
        status: HealthStatus::Healthy,
        labels: BTreeMap::new(),
        annotations: BTreeMap::new(),
        metrics: None,
        parent_uid: parent.map(|s| s.to_string()),
        age_seconds: Some(60),
        restart_count: Some(0),
    }
}

// --- Property 1: Resource Graph Consistency ---

#[test]
fn test_property_graph_consistency_after_adds() {
    let mut graph = ResourceGraph::new();

    // Add deployment -> replicaset -> pods hierarchy
    graph.upsert(make_node("deploy-1", "nginx", ResourceKind::Deployment, None));
    graph.upsert(make_node("rs-1", "nginx-rs", ResourceKind::ReplicaSet, Some("deploy-1")));
    graph.upsert(make_node("pod-1", "nginx-1", ResourceKind::Pod, Some("rs-1")));
    graph.upsert(make_node("pod-2", "nginx-2", ResourceKind::Pod, Some("rs-1")));
    graph.upsert(make_node("pod-3", "nginx-3", ResourceKind::Pod, Some("rs-1")));

    assert!(graph.is_consistent());
}

#[test]
fn test_property_graph_consistency_after_removal() {
    let mut graph = ResourceGraph::new();

    graph.upsert(make_node("deploy-1", "nginx", ResourceKind::Deployment, None));
    graph.upsert(make_node("rs-1", "nginx-rs", ResourceKind::ReplicaSet, Some("deploy-1")));
    graph.upsert(make_node("pod-1", "nginx-1", ResourceKind::Pod, Some("rs-1")));

    // Remove parent — children should now be inconsistent
    graph.remove("rs-1");
    assert!(!graph.is_consistent());
}

#[test]
fn test_property_graph_consistency_removes_with_children() {
    let mut graph = ResourceGraph::new();

    graph.upsert(make_node("ns-1", "default", ResourceKind::Namespace, None));
    graph.upsert(make_node("deploy-1", "nginx", ResourceKind::Deployment, Some("ns-1")));
    graph.upsert(make_node("pod-1", "nginx-1", ResourceKind::Pod, Some("deploy-1")));

    // Remove leaf first, then parent — should stay consistent
    graph.remove("pod-1");
    graph.remove("deploy-1");
    graph.remove("ns-1");
    assert!(graph.is_consistent());
    assert_eq!(graph.len(), 0);
}

// --- Resource Graph Operations ---

#[test]
fn test_upsert_creates_add_patch() {
    let mut graph = ResourceGraph::new();
    let node = make_node("pod-1", "nginx", ResourceKind::Pod, None);
    let patch = graph.upsert(node);
    assert!(matches!(patch, GraphPatch::Add { .. }));
}

#[test]
fn test_upsert_existing_creates_update_patch() {
    let mut graph = ResourceGraph::new();
    graph.upsert(make_node("pod-1", "nginx", ResourceKind::Pod, None));

    let updated = make_node("pod-1", "nginx-updated", ResourceKind::Pod, None);
    let patch = graph.upsert(updated);
    assert!(matches!(patch, GraphPatch::Update { .. }));
    assert_eq!(graph.get("pod-1").unwrap().name, "nginx-updated");
}

#[test]
fn test_remove_nonexistent_returns_none() {
    let mut graph = ResourceGraph::new();
    assert!(graph.remove("nonexistent").is_none());
}

#[test]
fn test_children_of_returns_correct_children() {
    let mut graph = ResourceGraph::new();
    graph.upsert(make_node("rs-1", "nginx-rs", ResourceKind::ReplicaSet, None));
    graph.upsert(make_node("pod-1", "nginx-1", ResourceKind::Pod, Some("rs-1")));
    graph.upsert(make_node("pod-2", "nginx-2", ResourceKind::Pod, Some("rs-1")));
    graph.upsert(make_node("pod-3", "other", ResourceKind::Pod, None)); // no parent

    let children = graph.children_of("rs-1");
    assert_eq!(children.len(), 2);
    assert!(children.iter().all(|c| c.parent_uid.as_deref() == Some("rs-1")));
}

// --- Health Summary ---

#[test]
fn test_health_summary_counts() {
    let mut graph = ResourceGraph::new();
    graph.upsert(make_node("pod-1", "healthy", ResourceKind::Pod, None));
    graph.upsert(make_node("pod-2", "healthy2", ResourceKind::Pod, None));

    let mut warning_node = make_node("pod-3", "warning", ResourceKind::Pod, None);
    warning_node.status = HealthStatus::Warning { message: "high mem".to_string() };
    graph.upsert(warning_node);

    let mut critical_node = make_node("pod-4", "critical", ResourceKind::Pod, None);
    critical_node.status = HealthStatus::Critical { message: "crash".to_string() };
    graph.upsert(critical_node);

    let summary = graph.health_summary();
    assert_eq!(summary.healthy, 2);
    assert_eq!(summary.warning, 1);
    assert_eq!(summary.critical, 1);
    assert_eq!(summary.unknown, 0);
}

// --- Stress test: Resource graph at scale ---

#[test]
fn test_stress_graph_1000_pods() {
    let mut graph = ResourceGraph::new();
    let start = std::time::Instant::now();

    // Create hierarchy: 5 namespaces -> 10 deployments each -> 20 pods each = 1000 pods
    for ns in 0..5 {
        let ns_uid = format!("ns-{}", ns);
        graph.upsert(make_node(&ns_uid, &format!("namespace-{}", ns), ResourceKind::Namespace, None));

        for deploy in 0..10 {
            let deploy_uid = format!("deploy-{}-{}", ns, deploy);
            graph.upsert(make_node(
                &deploy_uid,
                &format!("deploy-{}", deploy),
                ResourceKind::Deployment,
                Some(&ns_uid),
            ));

            for pod in 0..20 {
                let pod_uid = format!("pod-{}-{}-{}", ns, deploy, pod);
                graph.upsert(make_node(
                    &pod_uid,
                    &format!("pod-{}", pod),
                    ResourceKind::Pod,
                    Some(&deploy_uid),
                ));
            }
        }
    }

    let elapsed = start.elapsed();
    assert_eq!(graph.len(), 5 + 50 + 1000); // 5 ns + 50 deploys + 1000 pods
    assert!(graph.is_consistent());

    // Should complete in well under 1 second
    assert!(elapsed.as_millis() < 1000, "Graph construction took {}ms", elapsed.as_millis());

    // Test snapshot performance
    let snap_start = std::time::Instant::now();
    let snapshot = graph.snapshot();
    let snap_elapsed = snap_start.elapsed();
    assert_eq!(snapshot.len(), 1055);
    assert!(snap_elapsed.as_millis() < 100, "Snapshot took {}ms", snap_elapsed.as_millis());

    // Test health summary performance
    let health_start = std::time::Instant::now();
    let summary = graph.health_summary();
    let health_elapsed = health_start.elapsed();
    assert_eq!(summary.healthy, 1055);
    assert!(health_elapsed.as_millis() < 50, "Health summary took {}ms", health_elapsed.as_millis());
}

#[test]
fn test_stress_rapid_updates() {
    let mut graph = ResourceGraph::new();

    // Pre-populate
    for i in 0..100 {
        graph.upsert(make_node(&format!("pod-{}", i), &format!("pod-{}", i), ResourceKind::Pod, None));
    }

    let start = std::time::Instant::now();

    // Rapid upserts (simulating watch stream events)
    for round in 0..1000 {
        let uid = format!("pod-{}", round % 100);
        let mut node = make_node(&uid, &format!("pod-{}-r{}", round % 100, round), ResourceKind::Pod, None);
        if round % 10 == 0 {
            node.status = HealthStatus::Warning { message: "high cpu".to_string() };
        }
        graph.upsert(node);
    }

    let elapsed = start.elapsed();
    assert_eq!(graph.len(), 100);
    // 1000 updates in under 100ms
    assert!(elapsed.as_millis() < 100, "1000 updates took {}ms", elapsed.as_millis());
}
