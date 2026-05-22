#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <resource-group> <managed-identity-name> <app-insights-resource-id>"
  exit 1
fi

RESOURCE_GROUP="$1"
MANAGED_IDENTITY_NAME="$2"
APP_INSIGHTS_RESOURCE_ID="$3"

PRINCIPAL_ID=$(az identity show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$MANAGED_IDENTITY_NAME" \
  --query principalId \
  --output tsv)

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Monitoring Reader" \
  --scope "$APP_INSIGHTS_RESOURCE_ID" \
  --output table

echo "RBAC configured for managed identity principalId=$PRINCIPAL_ID"
