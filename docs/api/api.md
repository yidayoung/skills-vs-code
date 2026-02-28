# Marketplace API Specification

This document defines the marketplace APIs currently used by the extension.

Target audience: internal marketplace API implementers.

## 1. Base URL Configuration

The extension config only stores base host URL (without path):

```json
{
  "skills.apiUrls": [
    {
      "url": "https://your-market.example.com",
      "enabled": true,
      "name": "Internal Market",
      "priority": 100
    }
  ]
}
```

At runtime, the extension appends fixed paths to this base URL.

## 2. API List (Used by Extension)

1. `GET /api/search`
2. `GET /api/skills/all-time/{page}`
3. `GET /api/skills/trending/{page}`
4. `GET /api/skills/hot/{page}`

No other marketplace APIs are required by the extension right now.

## 3. Common Rules

- Method: `GET`
- Content type: `application/json`
- Timeout behavior: extension request timeout is `10s`
- Multi-market behavior: extension queries enabled markets in parallel; one market failure must not block others

## 4. `GET /api/search`

### 4.1 Query Parameters

- `q` (string, required): keyword
- `limit` (number, optional): max returned items

Example:

```http
GET /api/search?q=git&limit=10 HTTP/1.1
Host: your-market.example.com
Accept: application/json
```

### 4.2 Supported Response Shapes

Preferred:

```json
{
  "skills": [
    {
      "id": "vercel-labs/skills/find-skills",
      "source": "vercel-labs/skills",
      "skillId": "find-skills",
      "name": "find-skills",
      "installs": 350940
    }
  ]
}
```

Compatible fallback (array directly):

```json
[
  {
    "id": "vercel-labs/skills/find-skills",
    "source": "vercel-labs/skills",
    "skillId": "find-skills",
    "name": "find-skills",
    "installs": 350940
  }
]
```

## 5. Leaderboard APIs

- `GET /api/skills/all-time/{page}`
- `GET /api/skills/trending/{page}`
- `GET /api/skills/hot/{page}`

### 5.1 Path Parameters

- `page` (number, required): zero-based page index (`0`, `1`, ...)

### 5.2 Response Shape

```json
{
  "skills": [
    {
      "source": "vercel-labs/skills",
      "skillId": "find-skills",
      "name": "find-skills",
      "installs": 350940
    }
  ],
  "page": 0,
  "hasMore": true,
  "total": 78446
}
```

### 5.3 Pagination Semantics

- `skills`: current page data
- `page`: current page index returned by API
- `hasMore`: whether next page exists
- `total`: total items under current leaderboard view

The extension uses `hasMore` + `page` to auto-load next pages.

## 6. Skill Item Field Contract

The extension is compatible with multiple field variants, but this section defines recommended payload for internal APIs.

### 6.1 Recommended Minimum Fields (Strongly Recommended)

- `source` (string): repository source, for example `org/repo`
- `skillId` (string): skill folder id inside repository
- `name` (string): display name
- `installs` (number): install count
- `description` (string, optional): human-readable summary shown on skill card if provided

### 6.2 Additional Supported Fields

- `id` (string)
- `description` (string)
- `repository` / `repo` (string)
- `skillMdUrl` / `skill_md_url` / `readme_url` (string)
- `version` / `commit` / `tag` (string)
- `stars` / `star_count` / `stargazers_count` (number)
- `updatedAt` / `updated_at` / `last_updated` (string)

## 7. `source` Format Guidance

`source` is the most reliable input for extension-side normalization.

Recommended formats:

- GitHub short: `owner/repo`
- GitHub URL: `https://github.com/owner/repo`
- GitLab short: `gitlab.com/group/repo`
- GitLab URL: `https://gitlab.com/group/repo`
- With subpath: `owner/repo//skills/my-skill`

## 8. Error Handling Recommendations

Recommended status codes:

- `200` success
- `400` invalid params
- `429` rate limited
- `500` server error

Error body (recommended):

```json
{
  "error": "human-readable error message"
}
```

If a market API returns non-2xx or invalid payload, the extension treats that market as failed and continues with other configured markets.

## 9. Compatibility Notes

- Search endpoint accepts either `{ "skills": [...] }` or `[...]`.
- Leaderboard endpoints should return `{ skills, page, hasMore, total }` for best UX.
- Security audits endpoint is not consumed by extension marketplace UI.

## 10. cURL Examples

```bash
# Search
curl --get "https://your-market.example.com/api/search" \
  --data-urlencode "q=git" \
  --data-urlencode "limit=10"

# Leaderboard: all-time page 0
curl -sS "https://your-market.example.com/api/skills/all-time/0"

# Leaderboard: trending page 0
curl -sS "https://your-market.example.com/api/skills/trending/0"

# Leaderboard: hot page 0
curl -sS "https://your-market.example.com/api/skills/hot/0"
```
