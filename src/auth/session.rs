//! In-memory session store with TTL-based expiration.
//!
//! Sessions hold cluster credentials in memory only — never persisted to disk.
//! This is a core security design decision.

use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// A user session holding authentication state.
#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub created_at: Instant,
    pub expires_at: Instant,
    /// Arbitrary session data (cluster credentials, user info, etc.)
    pub data: serde_json::Value,
}

/// Thread-safe in-memory session store.
#[derive(Debug, Clone)]
pub struct SessionStore {
    sessions: Arc<DashMap<String, Session>>,
    ttl: Duration,
}

impl SessionStore {
    /// Create a new session store with the given TTL (in hours).
    pub fn new(ttl_hours: u64) -> Self {
        Self {
            sessions: Arc::new(DashMap::new()),
            ttl: Duration::from_secs(ttl_hours * 3600),
        }
    }

    /// Create a new session and return its token.
    pub fn create(&self, data: serde_json::Value) -> String {
        let id = Uuid::new_v4().to_string();
        let now = Instant::now();
        let session = Session {
            id: id.clone(),
            created_at: now,
            expires_at: now + self.ttl,
            data,
        };
        self.sessions.insert(id.clone(), session);
        id
    }

    /// Validate a session token and return the session if valid.
    pub fn validate(&self, token: &str) -> Option<Session> {
        let entry = self.sessions.get(token)?;
        if Instant::now() > entry.expires_at {
            // Session expired — remove it
            drop(entry);
            self.sessions.remove(token);
            return None;
        }
        Some(entry.clone())
    }

    /// Renew a session's expiration without changing its data.
    pub fn renew(&self, token: &str) -> bool {
        if let Some(mut entry) = self.sessions.get_mut(token) {
            entry.expires_at = Instant::now() + self.ttl;
            true
        } else {
            false
        }
    }

    /// Remove a session (logout).
    pub fn remove(&self, token: &str) -> bool {
        self.sessions.remove(token).is_some()
    }

    /// Remove all expired sessions. Call periodically from a background task.
    pub fn cleanup_expired(&self) -> usize {
        let now = Instant::now();
        let before = self.sessions.len();
        self.sessions.retain(|_, session| session.expires_at > now);
        before - self.sessions.len()
    }

    /// Number of active sessions.
    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    /// Whether the store is empty.
    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_validate_session() {
        let store = SessionStore::new(1); // 1 hour TTL
        let token = store.create(serde_json::json!({"user": "test"}));
        assert!(!token.is_empty());

        let session = store.validate(&token).unwrap();
        assert_eq!(session.id, token);
        assert_eq!(session.data["user"], "test");
    }

    #[test]
    fn test_invalid_token_returns_none() {
        let store = SessionStore::new(1);
        assert!(store.validate("nonexistent-token").is_none());
    }

    #[test]
    fn test_remove_session() {
        let store = SessionStore::new(1);
        let token = store.create(serde_json::json!({}));
        assert!(store.validate(&token).is_some());
        assert!(store.remove(&token));
        assert!(store.validate(&token).is_none());
    }

    #[test]
    fn test_renew_session() {
        let store = SessionStore::new(1);
        let token = store.create(serde_json::json!({}));
        assert!(store.renew(&token));
        assert!(store.validate(&token).is_some());
    }

    #[test]
    fn test_renew_nonexistent_returns_false() {
        let store = SessionStore::new(1);
        assert!(!store.renew("fake-token"));
    }

    #[test]
    fn test_session_count() {
        let store = SessionStore::new(1);
        assert!(store.is_empty());
        store.create(serde_json::json!({}));
        store.create(serde_json::json!({}));
        assert_eq!(store.len(), 2);
    }
}
