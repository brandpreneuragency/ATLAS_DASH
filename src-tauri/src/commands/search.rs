// Web search command. The frontend (src/services/search.ts) invokes
// `search_web` with a query plus optional Exa / Tavily API keys. We call
// the configured provider and normalize the response into the
// `SearchResult` shape the frontend expects:
//   { title: string; url: string; snippet: string }
//
// We use `reqwest` directly (already in the dependency closure via
// `tauri-plugin-http`) so the keychain never has to hand the raw API key
// to the webview. The `tauri-plugin-http` allowlist in
// `capabilities/default.json` covers the provider URLs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

// `serde` converts snake_case Rust field names to camelCase on the
// JavaScript side automatically, so the frontend can call
// `invoke('search_web', { query, exaKey, tavilyKey, provider })`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchArgs {
    pub query: String,
    pub exa_key: String,
    pub tavily_key: String,
    /// Optional: "tavily" | "exa". Defaults to "tavily" when a Tavily key
    /// is present, otherwise "exa".
    pub provider: Option<String>,
}

#[tauri::command]
pub async fn search_web(args: SearchArgs) -> Result<Vec<SearchResult>, String> {
    let query = args.query.trim();
    if query.is_empty() {
        return Err("Search query is empty.".to_string());
    }

    let provider = args
        .provider
        .as_deref()
        .map(str::to_lowercase)
        .unwrap_or_default();

    let chosen = match provider.as_str() {
        "exa" if !args.exa_key.is_empty() => "exa",
        "tavily" if !args.tavily_key.is_empty() => "tavily",
        _ => {
            if !args.tavily_key.is_empty() {
                "tavily"
            } else if !args.exa_key.is_empty() {
                "exa"
            } else {
                return Err(
                    "No search API key configured. Add a Tavily or Exa key in Settings."
                        .to_string(),
                );
            }
        }
    };

    match chosen {
        "tavily" => search_tavily(query, &args.tavily_key).await,
        "exa" => search_exa(query, &args.exa_key).await,
        _ => Err(format!("Unsupported search provider: {chosen}")),
    }
}

async fn search_tavily(query: &str, api_key: &str) -> Result<Vec<SearchResult>, String> {
    #[derive(Deserialize)]
    struct TavilyResponse {
        results: Vec<TavilyResult>,
    }
    #[derive(Deserialize)]
    struct TavilyResult {
        title: String,
        url: String,
        #[serde(default)]
        content: String,
    }

    let client = reqwest::Client::builder()
        .user_agent("TABS-Desktop/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "api_key": api_key,
        "query": query,
        "max_results": 5,
        "search_depth": "basic",
        "include_answer": false,
    });

    let resp = client
        .post("https://api.tavily.com/search")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Tavily request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Tavily returned {status}: {text}"));
    }

    let data: TavilyResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Tavily response: {e}"))?;

    Ok(data
        .results
        .into_iter()
        .map(|r| SearchResult {
            title: r.title,
            url: r.url,
            snippet: r.content,
        })
        .collect())
}

async fn search_exa(query: &str, api_key: &str) -> Result<Vec<SearchResult>, String> {
    #[derive(Deserialize)]
    struct ExaResponse {
        results: Vec<ExaResult>,
    }
    #[derive(Deserialize)]
    struct ExaResult {
        #[serde(default)]
        title: Option<String>,
        url: String,
        #[serde(default)]
        text: Option<String>,
        #[serde(default)]
        highlights: Option<Vec<String>>,
    }

    let client = reqwest::Client::builder()
        .user_agent("TABS-Desktop/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "query": query,
        "numResults": 5,
        "useAutoprompt": false,
        "contents": {
            "text": { "maxCharacters": 800 }
        }
    });

    let resp = client
        .post("https://api.exa.ai/search")
        .header("x-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Exa request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Exa returned {status}: {text}"));
    }

    let data: ExaResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Exa response: {e}"))?;

    Ok(data
        .results
        .into_iter()
        .map(|r| {
            let snippet = r
                .highlights
                .as_ref()
                .and_then(|h| h.first().cloned())
                .or(r.text)
                .unwrap_or_default();
            SearchResult {
                title: r.title.unwrap_or_else(|| r.url.clone()),
                url: r.url,
                snippet,
            }
        })
        .collect())
}
