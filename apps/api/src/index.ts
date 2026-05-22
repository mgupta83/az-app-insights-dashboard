import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import {
  createMyAppApplicationInsightsService,
  type NamedKqlQuery,
} from '@my-app/az-application-insights'

const typeDefs = `#graphql
  type RuntimeConfig {
    applicationInsightsAppId: String!
    defaultTimespan: String!
    blobContainerName: String!
  }

  type QueryTemplateParameter {
    name: String!
    description: String
    required: Boolean
    defaultValue: String
  }

  type NamedQuery {
    id: String!
    name: String!
    description: String
    query: String!
    parameters: [QueryTemplateParameter!]!
  }

  type TableColumn {
    name: String!
    type: String!
  }

  type QueryTable {
    name: String!
    columns: [TableColumn!]!
    rows: [[String!]!]!
  }

  type RunKqlResult {
    tables: [QueryTable!]!
  }

  input QueryParameterInput {
    name: String!
    value: String!
  }

  input QueryTemplateParameterInput {
    name: String!
    description: String
    required: Boolean
    defaultValue: String
  }

  input NamedQueryInput {
    id: String!
    name: String!
    description: String
    query: String!
    parameters: [QueryTemplateParameterInput!]
  }

  type Query {
    runtimeConfig: RuntimeConfig!
    listNamedQueries: [NamedQuery!]!
  }

  type Mutation {
    runKql(query: String!, timespan: String!, parameters: [QueryParameterInput!]): RunKqlResult!
    saveNamedQuery(input: NamedQueryInput!): NamedQuery!
  }
`

const service = await createMyAppApplicationInsightsService(process.env)

const resolvers = {
  Query: {
    runtimeConfig: () => {
      const config = service.getRuntimeConfig()
      return {
        applicationInsightsAppId: config.appId,
        defaultTimespan: config.defaultTimespan,
        blobContainerName: config.blobContainerName,
      }
    },
    listNamedQueries: async (): Promise<NamedKqlQuery[]> => service.listNamedQueries(),
  },
  Mutation: {
    runKql: async (
      _: unknown,
      args: { query: string; timespan: string; parameters?: Array<{ name: string; value: string }> },
    ) => {
      const result = await service.executeQuery({
        query: args.query,
        timespan: args.timespan,
        parameters: args.parameters,
      })

      return {
        tables: result.tables.map((table) => ({
          ...table,
          rows: table.rows.map((row) => row.map((cell) => String(cell ?? ''))),
        })),
      }
    },
    saveNamedQuery: async (
      _: unknown,
      args: { input: NamedKqlQuery },
    ): Promise<NamedKqlQuery> => service.saveNamedQuery(args.input),
  },
}

const server = new ApolloServer({ typeDefs, resolvers })

const port = Number(process.env.PORT ?? 4000)

const { url } = await startStandaloneServer(server, {
  listen: { port },
})

console.log(`GraphQL API is ready at ${url}`)
