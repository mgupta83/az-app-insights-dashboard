import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  type TableColumnsType,
  Typography,
} from 'antd'
import {
  GET_RUNTIME_CONFIG,
  LIST_NAMED_QUERIES,
  RUN_KQL,
  SAVE_NAMED_QUERY,
} from '../graphql/operations'
import type { NamedQuery, QueryResultTable, RunKqlResponse } from '../types'

const { TextArea } = Input
const { Title, Text } = Typography

const timeRanges = [
  { label: 'Last 1 hour', value: 'PT1H' },
  { label: 'Last 6 hours', value: 'PT6H' },
  { label: 'Last 24 hours', value: 'P1D' },
  { label: 'Last 7 days', value: 'P7D' },
  { label: 'Last 30 days', value: 'P30D' },
]

type TableRecord = Record<string, string | number | boolean | null> & { key: string }

const toRecords = (table?: QueryResultTable): TableRecord[] => {
  if (!table) {
    return []
  }

  return table.rows.map((row: Array<string | number | boolean | null>, rowIndex: number) =>
    table.columns.reduce<TableRecord>(
      (accumulator, column, columnIndex: number) => {
        accumulator[column.name] = row[columnIndex] ?? null
        return accumulator
      },
      { key: String(rowIndex) },
    ),
  )
}

export const ApplicationInsightsQueryDashboard = () => {
  const [query, setQuery] = useState('')
  const [timespan, setTimespan] = useState('P1D')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QueryResultTable>()
  const [isSaveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')

  const { data: runtimeConfigData } = useQuery(GET_RUNTIME_CONFIG)
  const { data: listData, refetch } = useQuery<{ listNamedQueries: NamedQuery[] }>(LIST_NAMED_QUERIES)

  const [runKql, { loading: isRunning }] = useMutation<RunKqlResponse>(RUN_KQL)
  const [saveNamedQuery, { loading: isSaving }] = useMutation(SAVE_NAMED_QUERY)

  const namedQueries = useMemo(() => listData?.listNamedQueries ?? [], [listData])

  const selectedTemplate = useMemo(
    () => namedQueries.find((candidate) => candidate.id === selectedTemplateId),
    [namedQueries, selectedTemplateId],
  )
  const activeParameters = selectedTemplate?.parameters ?? []

  const tableRecords = useMemo(() => toRecords(result), [result])

  const tableColumns: TableColumnsType<TableRecord> = useMemo(
    () =>
      (result?.columns ?? []).map((column: { name: string; type: string }) => ({
        title: (
          <Space>
            <Text strong>{column.name}</Text>
            <Tag>{column.type}</Tag>
          </Space>
        ),
        dataIndex: column.name,
        key: column.name,
        render: (value: unknown) => String(value ?? 'null'),
      })),
    [result],
  )

  const selectTemplate = (templateId: string): void => {
    setSelectedTemplateId(templateId)
    const resolvedTemplate = namedQueries.find((candidate) => candidate.id === templateId)
    if (resolvedTemplate) {
      setQuery(resolvedTemplate.query)
      setParameterValues(
        (resolvedTemplate.parameters ?? []).reduce<Record<string, string>>((accumulator, parameter: { name: string; defaultValue?: string }) => {
          accumulator[parameter.name] = parameter.defaultValue ?? ''
          return accumulator
        }, {}),
      )
    }
  }

  const runQuery = async (): Promise<void> => {
    const response = await runKql({
      variables: {
        query,
        timespan,
        parameters: Object.entries(parameterValues).map(([name, value]) => ({ name, value })),
      },
    })

    setResult(response.data?.runKql.tables?.[0])
  }

  const saveQueryTemplate = async (): Promise<void> => {
    await saveNamedQuery({
      variables: {
        input: {
          id: saveName,
          name: saveName,
          description: saveDescription,
          query,
          parameters: Array.from(new Set((query.match(/\{\{\s*([^\s{}]+)\s*\}\}/g) ?? []).map((entry) => entry.replace(/[{}\\s]/g, '')))).map(
            (name) => ({
              name,
              required: false,
              defaultValue: parameterValues[name] ?? '',
            }),
          ),
        },
      },
    })

    await refetch()
    setSaveModalOpen(false)
    setSaveName('')
    setSaveDescription('')
  }

  return (
    <Space orientation="vertical" size="large" className="w-full">
      <Card>
        <Title level={4}>Azure Application Insights (GraphQL-backed)</Title>
        <Text type="secondary">
          Connected App ID: {runtimeConfigData?.runtimeConfig?.applicationInsightsAppId ?? 'n/a'}
        </Text>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="Named KQL Templates">
            {namedQueries.length === 0 ? (
              <Empty description="No templates saved in blob storage." />
            ) : (
              <List
                dataSource={namedQueries}
                renderItem={(item) => (
                  <List.Item>
                    <Button type="link" onClick={() => selectTemplate(item.id)}>
                      {item.name}
                    </Button>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="Query Wizard">
            <Form layout="vertical">
              <Form.Item label="Template">
                <Select
                  allowClear
                  placeholder="Select named query"
                  value={selectedTemplateId}
                  options={namedQueries.map((item) => ({ label: item.name, value: item.id }))}
                  onChange={(value) => {
                    if (value) {
                      selectTemplate(value)
                    } else {
                      setSelectedTemplateId(undefined)
                    }
                  }}
                />
              </Form.Item>
              <Form.Item label="KQL Query">
                <TextArea value={query} onChange={(event) => setQuery(event.target.value)} autoSize={{ minRows: 6 }} />
              </Form.Item>
              {activeParameters.map((parameter: { name: string; description?: string }) => (
                <Form.Item key={parameter.name} label={`Parameter: ${parameter.name}`}>
                  <Input
                    placeholder={parameter.description ?? 'Value'}
                    value={parameterValues[parameter.name] ?? ''}
                    onChange={(event) =>
                      setParameterValues((currentValue) => ({
                        ...currentValue,
                        [parameter.name]: event.target.value,
                      }))
                    }
                  />
                </Form.Item>
              ))}
              <Form.Item label="Time range">
                <Select value={timespan} options={timeRanges} onChange={setTimespan} />
              </Form.Item>
              <Space>
                <Button type="primary" onClick={() => void runQuery()} loading={isRunning}>
                  Run Query
                </Button>
                <Button onClick={() => setSaveModalOpen(true)}>Save as Named Query</Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card title="Query Results">
        {result ? (
          <Table
            dataSource={tableRecords}
            columns={tableColumns}
            pagination={{ pageSize: 25 }}
            scroll={{ x: true }}
          />
        ) : (
          <Empty description="Run a query to view results." />
        )}
      </Card>

      <Modal
        title="Save named query"
        open={isSaveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={() => void saveQueryTemplate()}
        okButtonProps={{ loading: isSaving }}
      >
        <Form layout="vertical">
          <Form.Item label="Name" required>
            <Input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
          </Form.Item>
          <Form.Item label="Description">
            <Input value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
