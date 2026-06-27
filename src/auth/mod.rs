//! Authentication and session management module.
//!
//! Handles kubeconfig credential extraction, session lifecycle,
//! and security enforcement (localhost trust model + TLS shared mode).

pub mod session;

/// Placeholder for future OIDC integration
pub mod oidc {}
