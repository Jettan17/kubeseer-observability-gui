//! Authentication and session management module.
//!
//! Handles kubeconfig credential extraction, session lifecycle,
//! and security enforcement (localhost trust model + TLS shared mode).

pub mod kubeconfig;
pub mod middleware;
pub mod session;
