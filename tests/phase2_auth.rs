//! Phase 2 Test Suite: Authentication and Security Validation
//!
//! Tests kubeconfig parsing, session management, middleware auth flow.

use kubeseer::auth::kubeconfig::{
    list_contexts, resolve_context, AuthMethod, Kubeconfig,
};
use kubeseer::auth::session::SessionStore;

// --- Kubeconfig tests ---

const MULTI_CONTEXT_KUBECONFIG: &str = r#"
apiVersion: v1
kind: Config
current-context: staging
clusters:
- name: staging-cluster
  cluster:
    server: https://staging.k8s.io:6443
- name: production-cluster
  cluster:
    server: https://prod.k8s.io:6443
- name: dev-cluster
  cluster:
    server: https://dev.k8s.io:6443
contexts:
- name: staging
  context:
    cluster: staging-cluster
    user: staging-user
    namespace: staging-ns
- name: production
  context:
    cluster: production-cluster
    user: production-user
- name: dev
  context:
    cluster: dev-cluster
    user: dev-user
    namespace: default
users:
- name: staging-user
  user:
    token: staging-token-xyz
- name: production-user
  user:
    client-certificate-data: cHJvZC1jZXJ0
    client-key-data: cHJvZC1rZXk=
- name: dev-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args: ["eks", "get-token", "--cluster-name", "dev"]
"#;

#[test]
fn test_parse_multi_context_kubeconfig() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    assert_eq!(config.contexts.len(), 3);
    assert_eq!(config.clusters.len(), 3);
    assert_eq!(config.users.len(), 3);
    assert_eq!(config.current_context, Some("staging".to_string()));
}

#[test]
fn test_list_all_contexts() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    let contexts = list_contexts(&config);
    assert_eq!(contexts.len(), 3);
    assert!(contexts.contains(&"staging".to_string()));
    assert!(contexts.contains(&"production".to_string()));
    assert!(contexts.contains(&"dev".to_string()));
}

#[test]
fn test_resolve_token_auth() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    let resolved = resolve_context(&config, "staging").unwrap();
    assert_eq!(resolved.cluster_url, "https://staging.k8s.io:6443");
    assert_eq!(resolved.namespace, Some("staging-ns".to_string()));
    assert!(matches!(resolved.auth, AuthMethod::Token(ref t) if t == "staging-token-xyz"));
}

#[test]
fn test_resolve_client_cert_auth() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    let resolved = resolve_context(&config, "production").unwrap();
    assert_eq!(resolved.cluster_url, "https://prod.k8s.io:6443");
    assert!(matches!(resolved.auth, AuthMethod::ClientCertificate { .. }));
}

#[test]
fn test_resolve_exec_auth() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    let resolved = resolve_context(&config, "dev").unwrap();
    assert!(matches!(resolved.auth, AuthMethod::Exec(_)));
}

#[test]
fn test_resolve_invalid_context_returns_error() {
    let config: Kubeconfig = serde_yaml::from_str(MULTI_CONTEXT_KUBECONFIG).unwrap();
    let result = resolve_context(&config, "nonexistent");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("not found"));
}

#[test]
fn test_malformed_kubeconfig_fails() {
    let result: Result<Kubeconfig, _> = serde_yaml::from_str("not: valid: yaml: [");
    assert!(result.is_err());
}

// --- Session store tests ---

#[test]
fn test_session_create_and_validate() {
    let store = SessionStore::new(1);
    let token = store.create(serde_json::json!({"cluster": "test"}));
    let session = store.validate(&token).unwrap();
    assert_eq!(session.data["cluster"], "test");
}

#[test]
fn test_session_invalid_token_rejected() {
    let store = SessionStore::new(1);
    store.create(serde_json::json!({}));
    assert!(store.validate("invalid-token-abc").is_none());
}

#[test]
fn test_session_renew_extends_ttl() {
    let store = SessionStore::new(1);
    let token = store.create(serde_json::json!({}));
    assert!(store.renew(&token));
    // Should still be valid after renew
    assert!(store.validate(&token).is_some());
}

#[test]
fn test_session_remove_invalidates() {
    let store = SessionStore::new(1);
    let token = store.create(serde_json::json!({}));
    assert!(store.remove(&token));
    assert!(store.validate(&token).is_none());
}

#[test]
fn test_session_cleanup_expired() {
    // Create store with 0-hour TTL (immediate expiry)
    let store = SessionStore::new(0);
    store.create(serde_json::json!({}));
    store.create(serde_json::json!({}));
    
    // Wait briefly for expiry
    std::thread::sleep(std::time::Duration::from_millis(10));
    
    let cleaned = store.cleanup_expired();
    assert_eq!(cleaned, 2);
    assert_eq!(store.len(), 0);
}

#[test]
fn test_session_concurrent_access() {
    use std::sync::Arc;
    use std::thread;

    let store = Arc::new(SessionStore::new(1));
    let mut handles = vec![];

    // Create 100 sessions concurrently
    for i in 0..100 {
        let store_clone = store.clone();
        handles.push(thread::spawn(move || {
            store_clone.create(serde_json::json!({"id": i}))
        }));
    }

    let tokens: Vec<String> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    assert_eq!(store.len(), 100);

    // Validate all concurrently
    let mut validate_handles = vec![];
    for token in tokens {
        let store_clone = store.clone();
        validate_handles.push(thread::spawn(move || {
            store_clone.validate(&token).is_some()
        }));
    }

    let results: Vec<bool> = validate_handles.into_iter().map(|h| h.join().unwrap()).collect();
    assert!(results.iter().all(|&r| r));
}
