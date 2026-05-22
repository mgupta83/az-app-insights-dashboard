# az-app-insights-dashboard

Monorepo implementing an Azure Application Insights dashboard with managed-identity-only API access and GraphQL-driven UI workflows.

## Workspace layout

- `scripts/az`
  - `create-managed-identity.sh`: creates a user-assigned managed identity and assigns it to an Azure Function App.
  - `configure-app-insights-rbac.sh`: assigns `Monitoring Reader` RBAC to the managed identity at the Application Insights resource scope.
- `packages/cellix/az-application-insights-api-using-managed-identity`
  - portable package for running KQL queries using managed identity token auth only (no API keys).
- `packages/my-app/az-application-insights`
  - app-specific package that reads env/app settings, executes KQL queries through the portable package, and stores named queries in Azure Blob Storage.
- `packages/cellix/az-application-insights-ui`
  - portable React/Apollo package for query wizard + named-query listing/saving + query execution.
- `apps/api`
  - Apollo GraphQL API that serves UI requests and exposes config, named-query, and query-execution operations.
- `apps/ui`
  - dashboard app using route-level structure with a `page-container-component` pattern and components from `@cellix/az-application-insights-ui`.

## Required environment variables (API)

- `APP_INSIGHTS_APP_ID`
- `APP_INSIGHTS_DEFAULT_TIMESPAN` (optional, default `P1D`)
- `AZURE_CLIENT_ID` (optional for explicit user-assigned identity)
- `APP_INSIGHTS_QUERIES_BLOB_CONTAINER`
- One of:
  - `APP_INSIGHTS_QUERIES_BLOB_CONNECTION_STRING`
  - `APP_INSIGHTS_QUERIES_BLOB_ACCOUNT_URL`

## UI environment variable

- `VITE_GRAPHQL_ENDPOINT` (optional, default `http://localhost:4000/`)

## Local development

```bash
npm install
npm run dev:api
npm run dev:ui
```

## Validation

```bash
npm run lint
npm run build
npm run test
```
