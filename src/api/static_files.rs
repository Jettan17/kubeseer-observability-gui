use axum::http::{header, HeaderValue, StatusCode, Uri};
use axum::response::{Html, IntoResponse, Response};
use rust_embed::Embed;

/// Embedded frontend assets compiled into the binary at build time.
/// In development, this folder may be empty — the frontend must be built first.
#[derive(Embed)]
#[folder = "frontend/dist/"]
#[prefix = ""]
struct FrontendAssets;

/// Serve embedded static files or fall back to index.html for SPA routing.
pub async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // Try to serve the exact file requested
    if let Some(file) = FrontendAssets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        let mut response = (StatusCode::OK, file.data.to_vec()).into_response();

        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(mime.as_ref()).unwrap(),
        );

        // Cache immutable assets (files with content hashes in their names)
        if is_hashed_asset(path) {
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=31536000, immutable"),
            );
        } else {
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=0, must-revalidate"),
            );
        }

        return response;
    }

    // SPA fallback: serve index.html for any path that doesn't match a static file
    match FrontendAssets::get("index.html") {
        Some(index) => {
            let html = String::from_utf8_lossy(&index.data).to_string();
            Html(html).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            "Frontend not built. Run `npm run build` in the frontend/ directory.",
        )
            .into_response(),
    }
}

/// Heuristic: files with hash-like segments in their names are immutable assets.
/// e.g., `assets/index-a1b2c3d4.js`
fn is_hashed_asset(path: &str) -> bool {
    // Vite outputs files like: assets/index-BkH3pN2x.js
    path.starts_with("assets/") && path.contains('-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_hashed_asset() {
        assert!(is_hashed_asset("assets/index-a1b2c3d4.js"));
        assert!(is_hashed_asset("assets/style-BkH3pN2x.css"));
        assert!(!is_hashed_asset("index.html"));
        assert!(!is_hashed_asset("favicon.ico"));
    }
}
