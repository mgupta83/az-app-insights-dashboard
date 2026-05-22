#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <resource-group> <location> <identity-name> <function-app-name>"
  exit 1
fi

RESOURCE_GROUP="$1"
LOCATION="$2"
IDENTITY_NAME="$3"
FUNCTION_APP_NAME="$4"

az identity create \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --name "$IDENTITY_NAME" \
  --output none

IDENTITY_ID=$(az identity show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$IDENTITY_NAME" \
  --query id \
  --output tsv)

az functionapp identity assign \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP_NAME" \
  --identities "$IDENTITY_ID" \
  --output table

echo "Managed identity created and assigned: $IDENTITY_ID"
