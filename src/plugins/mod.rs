//! Plugin system for extensible data sources.
//!
//! Defines the `DataSource` trait that plugins implement to provide
//! custom observability data beyond the built-in integrations.

use serde_json::Value;

/// A data point produced by a plugin.
#[derive(Debug, Clone)]
pub struct DataPoint {
    pub source: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub payload: Value,
}

/// Trait for custom data source plugins.
pub trait DataSource: Send + Sync {
    /// Human-readable name of this data source.
    fn name(&self) -> &str;

    /// Initialize the data source. Called once on startup.
    fn init(&mut self) -> anyhow::Result<()>;

    /// Poll for new data points. Called periodically by the plugin host.
    fn poll(&self) -> Vec<DataPoint>;

    /// Shut down the data source. Called on application exit.
    fn shutdown(&mut self);
}
