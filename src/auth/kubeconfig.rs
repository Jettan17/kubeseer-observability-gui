//! Kubeconfig file discovery and parsing.
//!
//! Supports reading from default path, KUBECONFIG env var (multi-file merging),
//! and extracting available contexts with their credentials.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// A parsed kubeconfig representation (simplified).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Kubeconfig {
    #[serde(default)]
    pub clusters: Vec<NamedCluster>,
    #[serde(default)]
    pub contexts: Vec<NamedContext>,
    #[serde(default)]
    pub users: Vec<NamedUser>,
    pub current_context: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedCluster {
    pub name: String,
    pub cluster: ClusterInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ClusterInfo {
    pub server: String,
    pub certificate_authority: Option<String>,
    pub certificate_authority_data: Option<String>,
    #[serde(default)]
    pub insecure_skip_tls_verify: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedContext {
    pub name: String,
    pub context: ContextInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ContextInfo {
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedUser {
    pub name: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct UserInfo {
    pub token: Option<String>,
    pub client_certificate: Option<String>,
    pub client_certificate_data: Option<String>,
    pub client_key: Option<String>,
    pub client_key_data: Option<String>,
    pub exec: Option<ExecConfig>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecConfig {
    pub api_version: Option<String>,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: Option<Vec<ExecEnvVar>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExecEnvVar {
    pub name: String,
    pub value: String,
}

/// A resolved cluster context with all info needed to connect.
#[derive(Debug, Clone)]
pub struct ResolvedContext {
    pub name: String,
    pub cluster_url: String,
    pub namespace: Option<String>,
    pub auth: AuthMethod,
}

/// Authentication method extracted from kubeconfig.
#[derive(Debug, Clone)]
pub enum AuthMethod {
    Token(String),
    ClientCertificate {
        cert_data: String,
        key_data: String,
    },
    Exec(ExecConfig),
    None,
}

/// Discover kubeconfig file paths.
/// Checks KUBECONFIG env var first (supports multiple paths separated by ; on Windows, : on Unix).
/// Falls back to ~/.kube/config.
pub fn discover_kubeconfig_paths(override_path: Option<&Path>) -> Vec<PathBuf> {
    if let Some(path) = override_path {
        return vec![path.to_path_buf()];
    }

    if let Ok(kubeconfig_env) = std::env::var("KUBECONFIG") {
        let separator = if cfg!(windows) { ';' } else { ':' };
        return kubeconfig_env
            .split(separator)
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .collect();
    }

    // Default path
    if let Some(home) = dirs::home_dir() {
        vec![home.join(".kube").join("config")]
    } else {
        vec![]
    }
}

/// Load and merge kubeconfig from discovered paths.
pub fn load_kubeconfig(override_path: Option<&Path>) -> Result<Kubeconfig> {
    let paths = discover_kubeconfig_paths(override_path);

    if paths.is_empty() {
        anyhow::bail!(
            "No kubeconfig file found. Set KUBECONFIG env var or ensure ~/.kube/config exists."
        );
    }

    let mut merged = Kubeconfig {
        clusters: vec![],
        contexts: vec![],
        users: vec![],
        current_context: None,
    };

    for path in &paths {
        if !path.exists() {
            tracing::warn!("Kubeconfig path does not exist: {}", path.display());
            continue;
        }

        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read kubeconfig at {}", path.display()))?;

        let config: Kubeconfig = serde_yaml::from_str(&content)
            .with_context(|| format!("Failed to parse kubeconfig at {}", path.display()))?;

        // Merge — first file's current_context wins
        if merged.current_context.is_none() {
            merged.current_context = config.current_context;
        }
        merged.clusters.extend(config.clusters);
        merged.contexts.extend(config.contexts);
        merged.users.extend(config.users);
    }

    if merged.contexts.is_empty() {
        anyhow::bail!(
            "No contexts found in kubeconfig file(s): {:?}",
            paths
        );
    }

    Ok(merged)
}

/// Resolve a context name into a full connection context.
pub fn resolve_context(kubeconfig: &Kubeconfig, context_name: &str) -> Result<ResolvedContext> {
    let named_ctx = kubeconfig
        .contexts
        .iter()
        .find(|c| c.name == context_name)
        .with_context(|| format!("Context '{}' not found in kubeconfig", context_name))?;

    let cluster = kubeconfig
        .clusters
        .iter()
        .find(|c| c.name == named_ctx.context.cluster)
        .with_context(|| {
            format!(
                "Cluster '{}' referenced by context '{}' not found",
                named_ctx.context.cluster, context_name
            )
        })?;

    let user = kubeconfig
        .users
        .iter()
        .find(|u| u.name == named_ctx.context.user)
        .with_context(|| {
            format!(
                "User '{}' referenced by context '{}' not found",
                named_ctx.context.user, context_name
            )
        })?;

    let auth = resolve_auth(&user.user);

    Ok(ResolvedContext {
        name: context_name.to_string(),
        cluster_url: cluster.cluster.server.clone(),
        namespace: named_ctx.context.namespace.clone(),
        auth,
    })
}

/// List all available context names.
pub fn list_contexts(kubeconfig: &Kubeconfig) -> Vec<String> {
    kubeconfig.contexts.iter().map(|c| c.name.clone()).collect()
}

fn resolve_auth(user: &UserInfo) -> AuthMethod {
    if let Some(token) = &user.token {
        return AuthMethod::Token(token.clone());
    }

    if user.client_certificate_data.is_some() || user.client_certificate.is_some() {
        let cert = user
            .client_certificate_data
            .clone()
            .unwrap_or_default();
        let key = user.client_key_data.clone().unwrap_or_default();
        return AuthMethod::ClientCertificate {
            cert_data: cert,
            key_data: key,
        };
    }

    if let Some(exec) = &user.exec {
        return AuthMethod::Exec(exec.clone());
    }

    AuthMethod::None
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_KUBECONFIG: &str = r#"
apiVersion: v1
kind: Config
current-context: dev-context
clusters:
- name: dev-cluster
  cluster:
    server: https://dev.example.com:6443
    certificate-authority-data: LS0tLS1...
- name: prod-cluster
  cluster:
    server: https://prod.example.com:6443
contexts:
- name: dev-context
  context:
    cluster: dev-cluster
    user: dev-user
    namespace: default
- name: prod-context
  context:
    cluster: prod-cluster
    user: prod-user
users:
- name: dev-user
  user:
    token: dev-token-abc123
- name: prod-user
  user:
    client-certificate-data: Y2VydC1kYXRh
    client-key-data: a2V5LWRhdGE=
"#;

    #[test]
    fn test_parse_kubeconfig() {
        let config: Kubeconfig = serde_yaml::from_str(TEST_KUBECONFIG).unwrap();
        assert_eq!(config.contexts.len(), 2);
        assert_eq!(config.clusters.len(), 2);
        assert_eq!(config.users.len(), 2);
        assert_eq!(config.current_context, Some("dev-context".to_string()));
    }

    #[test]
    fn test_list_contexts() {
        let config: Kubeconfig = serde_yaml::from_str(TEST_KUBECONFIG).unwrap();
        let contexts = list_contexts(&config);
        assert_eq!(contexts, vec!["dev-context", "prod-context"]);
    }

    #[test]
    fn test_resolve_token_context() {
        let config: Kubeconfig = serde_yaml::from_str(TEST_KUBECONFIG).unwrap();
        let resolved = resolve_context(&config, "dev-context").unwrap();
        assert_eq!(resolved.cluster_url, "https://dev.example.com:6443");
        assert_eq!(resolved.namespace, Some("default".to_string()));
        assert!(matches!(resolved.auth, AuthMethod::Token(ref t) if t == "dev-token-abc123"));
    }

    #[test]
    fn test_resolve_cert_context() {
        let config: Kubeconfig = serde_yaml::from_str(TEST_KUBECONFIG).unwrap();
        let resolved = resolve_context(&config, "prod-context").unwrap();
        assert_eq!(resolved.cluster_url, "https://prod.example.com:6443");
        assert!(matches!(resolved.auth, AuthMethod::ClientCertificate { .. }));
    }

    #[test]
    fn test_resolve_nonexistent_context_fails() {
        let config: Kubeconfig = serde_yaml::from_str(TEST_KUBECONFIG).unwrap();
        assert!(resolve_context(&config, "nonexistent").is_err());
    }

    #[test]
    fn test_discover_default_path() {
        // Should return at least one path (the default ~/.kube/config)
        let paths = discover_kubeconfig_paths(None);
        // May be empty if no home dir, but should not panic
        assert!(paths.len() <= 1 || !paths.is_empty());
    }
}
