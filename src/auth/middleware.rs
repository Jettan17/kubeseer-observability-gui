//! Authentication middleware for Axum.
//!
//! In localhost mode: trusts all requests (same security model as kubectl).
//! In shared/TLS mode: validates session tokens from cookies or Authorization header.

use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

use super::session::SessionStore;

/// Shared application state for auth.
#[derive(Clone)]
pub struct AuthState {
    pub session_store: Arc<SessionStore>,
    pub localhost_mode: bool,
}

/// Middleware that enforces authentication.
/// In localhost mode, all requests are allowed.
/// In shared mode, requires a valid session token.
pub async fn auth_middleware(
    axum::extract::State(state): axum::extract::State<AuthState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Localhost mode — implicit trust
    if state.localhost_mode {
        return Ok(next.run(request).await);
    }

    // Extract token from Authorization header or cookie
    let token = extract_token(&request);

    match token {
        Some(t) => {
            if state.session_store.validate(&t).is_some() {
                Ok(next.run(request).await)
            } else {
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Extract session token from request headers.
/// Checks Authorization: Bearer <token> first, then a session cookie.
fn extract_token(request: &Request) -> Option<String> {
    // Check Authorization header
    if let Some(auth_header) = request.headers().get(header::AUTHORIZATION) {
        if let Ok(value) = auth_header.to_str() {
            if let Some(token) = value.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // Check cookie
    if let Some(cookie_header) = request.headers().get(header::COOKIE) {
        if let Ok(cookies) = cookie_header.to_str() {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if let Some(token) = cookie.strip_prefix("kubeseer_session=") {
                    return Some(token.to_string());
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request as HttpRequest;

    #[test]
    fn test_extract_token_from_bearer() {
        let req = HttpRequest::builder()
            .header("Authorization", "Bearer my-token-123")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("my-token-123".to_string()));
    }

    #[test]
    fn test_extract_token_from_cookie() {
        let req = HttpRequest::builder()
            .header("Cookie", "other=val; kubeseer_session=session-abc; foo=bar")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("session-abc".to_string()));
    }

    #[test]
    fn test_extract_token_none() {
        let req = HttpRequest::builder().body(Body::empty()).unwrap();
        assert_eq!(extract_token(&req), None);
    }

    #[test]
    fn test_extract_token_bearer_priority_over_cookie() {
        let req = HttpRequest::builder()
            .header("Authorization", "Bearer bearer-token")
            .header("Cookie", "kubeseer_session=cookie-token")
            .body(Body::empty())
            .unwrap();
        // Bearer takes priority
        assert_eq!(extract_token(&req), Some("bearer-token".to_string()));
    }
}
