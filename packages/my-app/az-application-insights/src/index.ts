import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'
import {
  ApplicationInsightsManagedIdentityClient,
  createApplicationInsightsManagedIdentityClient,
  type KqlQueryResponse,
} from '@cellix/az-application-insights-api-using-managed-identity'

export type NamedQueryParameter = {
  name: string
  description?: string
  required?: boolean
  defaultValue?: string
}

export type NamedKqlQuery = {
  id: string
  name: string
  description?: string
  query: string
  parameters?: NamedQueryParameter[]
}

export type QueryParameterInput = {
  name: string
  value: string
}

export type ExecuteQueryRequest = {
  query?: string
  timespan?: string
  namedQuery?: string
  parameters?: QueryParameterInput[]
}

export type ApplicationInsightsAppConfig = {
  appId: string
  defaultTimespan: string
  managedIdentityClientId?: string
  blobContainerName: string
}

export type MyAppInsightsService = {
  getRuntimeConfig: () => ApplicationInsightsAppConfig
  listNamedQueries: () => Promise<NamedKqlQuery[]>
  saveNamedQuery: (query: NamedKqlQuery) => Promise<NamedKqlQuery>
  executeQuery: (request: ExecuteQueryRequest) => Promise<KqlQueryResponse>
}

const DEFAULT_TIMESPAN = 'P1D'

const sanitizeBlobName = (input: string): string => `${input.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.json`

export const renderQueryTemplate = (template: string, parameters: QueryParameterInput[] = []): string => {
  return template.replace(/\{\{\s*([^\s{}]+)\s*\}\}/g, (fullMatch, parameterName: string) => {
    const resolved = parameters.find((parameter) => parameter.name === parameterName)
    return resolved?.value ?? fullMatch
  })
}

const readBlobAsString = async (container: ContainerClient, blobName: string): Promise<string> => {
  const blobClient = container.getBlobClient(blobName)
  const downloadResult = await blobClient.download()
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    downloadResult.readableStreamBody?.on('data', (chunk: Buffer) => chunks.push(chunk))
    downloadResult.readableStreamBody?.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    downloadResult.readableStreamBody?.on('error', reject)
  })
}

const createBlobContainerClient = async (env: NodeJS.ProcessEnv): Promise<ContainerClient | undefined> => {
  const containerName = env.APP_INSIGHTS_QUERIES_BLOB_CONTAINER
  if (!containerName) {
    return undefined
  }

  const connectionString = env.APP_INSIGHTS_QUERIES_BLOB_CONNECTION_STRING
  let serviceClient: BlobServiceClient

  if (connectionString) {
    serviceClient = BlobServiceClient.fromConnectionString(connectionString)
  } else {
    const accountUrl = env.APP_INSIGHTS_QUERIES_BLOB_ACCOUNT_URL
    if (!accountUrl) {
      return undefined
    }

    serviceClient = new BlobServiceClient(
      accountUrl,
      new DefaultAzureCredential({ managedIdentityClientId: env.AZURE_CLIENT_ID }),
    )
  }

  const container = serviceClient.getContainerClient(containerName)
  await container.createIfNotExists()
  return container
}

const parseNamedQuery = (value: string): NamedKqlQuery => {
  const parsed = JSON.parse(value) as NamedKqlQuery
  if (!parsed.id || !parsed.name || !parsed.query) {
    throw new Error('Stored named query JSON is invalid.')
  }
  return parsed
}

export const createMyAppApplicationInsightsService = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<MyAppInsightsService> => {
  const appId = env.APP_INSIGHTS_APP_ID
  if (!appId) {
    throw new Error('APP_INSIGHTS_APP_ID is required.')
  }

  const defaultTimespan = env.APP_INSIGHTS_DEFAULT_TIMESPAN ?? DEFAULT_TIMESPAN
  const managedIdentityClientId = env.AZURE_CLIENT_ID
  const blobContainer = await createBlobContainerClient(env)
  const memoryStore = new Map<string, NamedKqlQuery>()

  const client: ApplicationInsightsManagedIdentityClient =
    createApplicationInsightsManagedIdentityClient({
      appId,
      managedIdentityClientId,
    })

  const listNamedQueries = async (): Promise<NamedKqlQuery[]> => {
    if (!blobContainer) {
      return Array.from(memoryStore.values()).sort((first, second) => first.name.localeCompare(second.name))
    }

    const results: NamedKqlQuery[] = []
    for await (const blob of blobContainer.listBlobsFlat()) {
      if (!blob.name.endsWith('.json')) {
        continue
      }
      const blobPayload = await readBlobAsString(blobContainer, blob.name)
      results.push(parseNamedQuery(blobPayload))
    }

    return results.sort((first, second) => first.name.localeCompare(second.name))
  }

  const saveNamedQuery = async (query: NamedKqlQuery): Promise<NamedKqlQuery> => {
    const id = query.id || query.name
    const serialized: NamedKqlQuery = {
      ...query,
      id,
      parameters: query.parameters ?? [],
    }

    if (!blobContainer) {
      memoryStore.set(serialized.id, serialized)
      return serialized
    }

    const blobName = sanitizeBlobName(serialized.id)
    const blobClient = blobContainer.getBlockBlobClient(blobName)
    await blobClient.uploadData(Buffer.from(JSON.stringify(serialized, null, 2), 'utf8'), {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
      },
    })

    return serialized
  }

  const executeQuery = async (request: ExecuteQueryRequest): Promise<KqlQueryResponse> => {
    const templates = await listNamedQueries()
    const selectedTemplate = request.namedQuery
      ? templates.find((template) => template.name === request.namedQuery || template.id === request.namedQuery)
      : undefined

    const querySource = request.query ?? selectedTemplate?.query ?? ''
    const queryToRun = renderQueryTemplate(querySource, request.parameters)
    if (!queryToRun.trim()) {
      throw new Error('Either query or namedQuery must resolve to a non-empty KQL query.')
    }

    return client.query({
      query: queryToRun,
      timespan: request.timespan ?? defaultTimespan,
    })
  }

  return {
    getRuntimeConfig: () => ({
      appId,
      defaultTimespan,
      managedIdentityClientId,
      blobContainerName: blobContainer?.containerName ?? 'in-memory',
    }),
    listNamedQueries,
    saveNamedQuery,
    executeQuery,
  }
}
