use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

// ── Exa API types ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ExaHighlightOptions {
    #[serde(rename = "numSentences")]
    num_sentences: u8,
    #[serde(rename = "highlightsPerUrl")]
    highlights_per_url: u8,
}

#[derive(Serialize)]
struct ExaRequest<'a> {
    query: &'a str,
    #[serde(rename = "numResults")]
    num_results: u8,
    highlights: ExaHighlightOptions,
}

#[derive(Deserialize)]
struct ExaResultItem {
    title: Option<String>,
    url: Option<String>,
    highlights: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct ExaResponse {
    results: Vec<ExaResultItem>,
}

// ── Tavily API types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
struct TavilyRequest<'a> {
    api_key: &'a str,
    query: &'a str,
    max_results: u8,
    search_depth: &'static str,
}

#[derive(Deserialize)]
struct TavilyResultItem {
    title: Option<String>,
    url: Option<String>,
    content: Option<String>,
}

#[derive(Deserialize)]
struct TavilyResponse {
    results: Vec<TavilyResultItem>,
}

// ── Search functions ───────────────────────────────────────────────────────────

async fn exa_search(client: &Client, query: &str, api_key: &str) -> Result<Vec<SearchResult>, String> {
    let body = ExaRequest {
        query,
        num_results: 5,
        highlights: ExaHighlightOptions {
            num_sentences: 2,
            highlights_per_url: 1,
        },
    };

    let resp = client
        .post("https://api.exa.ai/search")
        .header("x-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Exa network error: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Exa error {status}: {text}"));
    }

    let data: ExaResponse = resp
        .json()
        .await
        .map_err(|e| format!("Exa parse error: {e}"))?;

    Ok(data
        .results
        .into_iter()
        .map(|r| SearchResult {
            title: r.title.unwrap_or_default(),
            url: r.url.unwrap_or_default(),
            snippet: r
                .highlights
                .and_then(|h| h.into_iter().next())
                .unwrap_or_default(),
        })
        .collect())
}

async fn tavily_search(client: &Client, query: &str, api_key: &str) -> Result<Vec<SearchResult>, String> {
    let body = TavilyRequest {
        api_key,
        query,
        max_results: 5,
        search_depth: "basic",
    };

    let resp = client
        .post("https://api.tavily.com/search")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Tavily network error: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Tavily error {status}: {text}"));
    }

    let data: TavilyResponse = resp
        .json()
        .await
        .map_err(|e| format!("Tavily parse error: {e}"))?;

    Ok(data
        .results
        .into_iter()
        .map(|r| SearchResult {
            title: r.title.unwrap_or_default(),
            url: r.url.unwrap_or_default(),
            snippet: r.content.unwrap_or_default(),
        })
        .collect())
}

// ── Tauri command ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_web(
    query: String,
    exa_key: String,
    tavily_key: String,
) -> Result<Vec<SearchResult>, String> {
    let client = Client::new();

    if !exa_key.is_empty() {
        match exa_search(&client, &query, &exa_key).await {
            Ok(results) if !results.is_empty() => return Ok(results),
            _ => {} // empty or error — fall through to Tavily
        }
    }

    if !tavily_key.is_empty() {
        return tavily_search(&client, &query, &tavily_key).await;
    }

    Err("No search API keys configured. Add an Exa or Tavily API key in Settings.".into())
}
