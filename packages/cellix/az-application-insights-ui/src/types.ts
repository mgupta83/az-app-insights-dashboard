export type QueryTemplateParameter = {
  name: string
  description?: string
  required?: boolean
  defaultValue?: string
}

export type NamedQuery = {
  id: string
  name: string
  description?: string
  query: string
  parameters: QueryTemplateParameter[]
}

type QueryResultColumn = {
  name: string
  type: string
}

export type QueryResultTable = {
  name: string
  columns: QueryResultColumn[]
  rows: Array<Array<string | number | boolean | null>>
}

export type RunKqlResponse = {
  runKql: {
    tables: QueryResultTable[]
  }
}
