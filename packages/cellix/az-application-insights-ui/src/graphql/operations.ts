import { gql } from '@apollo/client'

export const GET_RUNTIME_CONFIG = gql`
  query GetRuntimeConfig {
    runtimeConfig {
      applicationInsightsAppId
      defaultTimespan
    }
  }
`

export const LIST_NAMED_QUERIES = gql`
  query ListNamedQueries {
    listNamedQueries {
      id
      name
      description
      query
      parameters {
        name
        description
        required
        defaultValue
      }
    }
  }
`

export const RUN_KQL = gql`
  mutation RunKql($query: String!, $timespan: String!, $parameters: [QueryParameterInput!]) {
    runKql(query: $query, timespan: $timespan, parameters: $parameters) {
      tables {
        name
        columns {
          name
          type
        }
        rows
      }
    }
  }
`

export const SAVE_NAMED_QUERY = gql`
  mutation SaveNamedQuery($input: NamedQueryInput!) {
    saveNamedQuery(input: $input) {
      id
      name
      description
      query
      parameters {
        name
        description
        required
        defaultValue
      }
    }
  }
`
