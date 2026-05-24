# Error Handling

Expected business failures return `Result`. Unexpected programmer, infrastructure, and availability
failures may throw.

Examples:

- Paying an already paid order: `Result` error.
- Order not found in a usecase: `Result` error.
- Stale optimistic version in a repository: typed infrastructure error.
- Database connection loss: thrown error handled by runtime middleware.

HTTP adapters map `Result` errors to 4xx responses and let unexpected errors flow to the global error
handler.
