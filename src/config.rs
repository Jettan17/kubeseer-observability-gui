use clap::Parser;
use std::net::IpAddr;
use std::path::PathBuf;

/// KubeObserve — A high-performance Kubernetes observability GUI
#[derive(Parser, Debug, Clone)]
#[command(name = "kubeobserve", version, about, long_about = None)]
pub struct Config {
    /// Address to bind the HTTP server to.
    /// Defaults to 127.0.0.1 (localhost only) for security.
    #[arg(long, env = "KUBEOBSERVE_HOST", default_value = "127.0.0.1")]
    pub host: IpAddr,

    /// Port to bind the HTTP server to.
    /// Use 0 for a random available port.
    #[arg(short, long, env = "KUBEOBSERVE_PORT", default_value_t = 0)]
    pub port: u16,

    /// Path to kubeconfig file.
    /// If not set, uses the default kubeconfig location or KUBECONFIG env var.
    #[arg(long, env = "KUBECONFIG")]
    pub kubeconfig: Option<PathBuf>,

    /// Enable TLS (required when binding to non-localhost addresses).
    #[arg(long, env = "KUBEOBSERVE_TLS")]
    pub tls: bool,

    /// Path to TLS certificate file (PEM format).
    #[arg(long, env = "KUBEOBSERVE_TLS_CERT", requires = "tls")]
    pub tls_cert: Option<PathBuf>,

    /// Path to TLS private key file (PEM format).
    #[arg(long, env = "KUBEOBSERVE_TLS_KEY", requires = "tls")]
    pub tls_key: Option<PathBuf>,

    /// Session timeout in hours.
    #[arg(long, env = "KUBEOBSERVE_SESSION_TIMEOUT", default_value_t = 8)]
    pub session_timeout_hours: u64,

    /// Maximum number of simultaneous cluster connections.
    #[arg(long, env = "KUBEOBSERVE_MAX_CLUSTERS", default_value_t = 10)]
    pub max_clusters: usize,

    /// Log level (trace, debug, info, warn, error).
    #[arg(long, env = "KUBEOBSERVE_LOG_LEVEL", default_value = "info")]
    pub log_level: String,

    /// Disable automatic browser opening on startup.
    #[arg(long, env = "KUBEOBSERVE_NO_OPEN")]
    pub no_open: bool,

    /// Optional TOML configuration file path.
    #[arg(long, env = "KUBEOBSERVE_CONFIG")]
    pub config_file: Option<PathBuf>,
}

impl Config {
    /// Parse configuration from CLI arguments and environment variables.
    pub fn load() -> Self {
        let config = Config::parse();
        config.validate().expect("Invalid configuration");
        config
    }

    /// Validate configuration consistency.
    fn validate(&self) -> anyhow::Result<&Self> {
        // If binding to non-localhost, TLS must be enabled
        if !self.host.is_loopback() && !self.tls {
            anyhow::bail!(
                "TLS is required when binding to non-localhost address ({}). \
                 Use --tls with --tls-cert and --tls-key, or bind to 127.0.0.1.",
                self.host
            );
        }

        // If TLS is enabled, cert and key must be provided
        if self.tls && (self.tls_cert.is_none() || self.tls_key.is_none()) {
            anyhow::bail!(
                "Both --tls-cert and --tls-key are required when TLS is enabled."
            );
        }

        Ok(self)
    }

    /// Returns true if the server is binding to localhost only.
    pub fn is_localhost(&self) -> bool {
        self.host.is_loopback()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_is_localhost() {
        let config = Config {
            host: "127.0.0.1".parse().unwrap(),
            port: 0,
            kubeconfig: None,
            tls: false,
            tls_cert: None,
            tls_key: None,
            session_timeout_hours: 8,
            max_clusters: 10,
            log_level: "info".to_string(),
            no_open: false,
            config_file: None,
        };
        assert!(config.is_localhost());
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_non_localhost_without_tls_fails() {
        let config = Config {
            host: "0.0.0.0".parse().unwrap(),
            port: 8080,
            kubeconfig: None,
            tls: false,
            tls_cert: None,
            tls_key: None,
            session_timeout_hours: 8,
            max_clusters: 10,
            log_level: "info".to_string(),
            no_open: false,
            config_file: None,
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_tls_without_cert_fails() {
        let config = Config {
            host: "0.0.0.0".parse().unwrap(),
            port: 8080,
            kubeconfig: None,
            tls: true,
            tls_cert: None,
            tls_key: None,
            session_timeout_hours: 8,
            max_clusters: 10,
            log_level: "info".to_string(),
            no_open: false,
            config_file: None,
        };
        assert!(config.validate().is_err());
    }
}
