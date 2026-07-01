use kubeseer::config::Config;
use anyhow::Result;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    // Load configuration from CLI args and environment
    let config = Config::load();

    // Initialize tracing/logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new(&config.log_level)),
        )
        .init();

    tracing::info!("kubeseer v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("Binding to {}:{}", config.host, config.port);

    // Build the Axum application
    let app = kubeseer::api::build_router(&config);

    // Bind the listener
    let addr = std::net::SocketAddr::new(config.host, config.port);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let local_addr = listener.local_addr()?;

    tracing::info!("Server listening on http://{}", local_addr);

    // Open browser if in localhost mode and not disabled
    if config.is_localhost() && !config.no_open {
        let url = format!("http://{}", local_addr);
        if let Err(e) = open::that(&url) {
            tracing::warn!("Failed to open browser: {}", e);
        }
    }

    // Serve
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    tracing::info!("Received shutdown signal");
}
