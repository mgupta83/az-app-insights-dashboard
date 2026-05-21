# az-app-insights-dashboard

A Vite + React + TypeScript dashboard for running KQL queries against an Azure Application Insights resource and viewing query results in a portal-style experience.

## Tech stack

- Vite
- React + TypeScript
- Ant Design
- Tailwind CSS

## Features

- Connect using Application Insights App ID
- Authenticate with API key and/or bearer token
- KQL editor with configurable timespan
- Response viewer tabs:
  - Results table (sorting + pagination)
  - Quick chart for datetime/string + numeric result sets
  - Schema view (column names + types)
  - Statistics JSON
  - Full raw JSON
- Export results to CSV and JSON
- Query history with quick query reuse

## Run locally

```bash
npm install
npm run dev
```

## Build and lint

```bash
npm run lint
npm run build
```
