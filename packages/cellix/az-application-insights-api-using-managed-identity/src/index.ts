import { DefaultAzureCredential } from '@azure/identity'
import type { TokenCredential } from '@azure/core-auth'

export type AppInsightsManagedIdentityConfig = {
  appId: string
  endpoint?: string
  managedIdentityClientId?: string
  credential?: TokenCredential
}

export type KqlQueryRequest = {
  query: string
  timespan?: string
}

export type KqlQueryResponse = {
  tables: Array<{
    name: string
    columns: Array<{ name: string; type: string }>
    rows: Array<Array<string | number | boolean | null>>
  }>
  statistics?: Record<string, unknown>
}

const DEFAULT_SCOPE = 'https://api.applicationinsights.io/.default'
const DEFAULT_ENDPOINT = 'https://api.applicationinsights.io'

export class ApplicationInsightsManagedIdentityClient {
  private readonly appId: string
  private readonly endpoint: string
  private readonly credential: TokenCredential

  constructor(config: AppInsightsManagedIdentityConfig) {
    if (!config.appId) {
      throw new Error('Application Insights appId is required.')
    }

    this.appId = config.appId
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT
    this.credential =
      config.credential ??
      new DefaultAzureCredential({
        managedIdentityClientId: config.managedIdentityClientId,
      })
  }

  async query(request: KqlQueryRequest): Promise<KqlQueryResponse> {
    if (!request.query.trim()) {
      throw new Error('KQL query is required.')
    }

    const token = await this.credential.getToken(DEFAULT_SCOPE)
    if (!token?.token) {
      throw new Error('Unable to acquire managed identity access token.')
    }

    const params = new URLSearchParams({ query: request.query })
    if (request.timespan) {
      params.set('timespan', request.timespan)
    }

    const response = await fetch(
      `${this.endpoint}/v1/apps/${encodeURIComponent(this.appId)}/query?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      const errorPayload = await response.text()
      throw new Error(errorPayload || `App Insights query failed: ${response.status}`)
    }

    return (await response.json()) as KqlQueryResponse
  }
}

export const createApplicationInsightsManagedIdentityClient = (
  config: AppInsightsManagedIdentityConfig,
): ApplicationInsightsManagedIdentityClient => new ApplicationInsightsManagedIdentityClient(config)
