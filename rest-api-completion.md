# Plan for GitHub REST API v3 Completion

Implement the following endpoints in `app.ts`:

1.  **Contents** (`GET /repos/:owner/:repo/contents/:path`)
    - Retrieve file content or directory listing from the repository.
2.  **Labels** (`GET /repos/:owner/:repo/labels`, `POST /repos/:owner/:repo/labels`)
    - List labels for a repo.
    - Create a label for a repo.
3.  **Issues** (`GET /repos/:owner/:repo/issues`, `POST /repos/:owner/:repo/issues`, `GET /repos/:owner/:repo/issues/:issue_number`)
    - List issues.
    - Create an issue.
    - Get a single issue.
4.  **Pull Requests** (`GET /repos/:owner/:repo/pulls`, `POST /repos/:owner/:repo/pulls`, `GET /repos/:owner/:repo/pulls/:pull_number`)
    - List PRs.
    - Create a PR.
    - Get a single PR.
5.  **Pagination**
    - Support standard GitHub pagination (`page`, `per_page` query params).

The implementation will use the existing `store` object to manage state.
