import {
  AreaChartOutlined,
  CodeOutlined,
  DownloadOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

const { Header, Content } = Layout
const { TextArea } = Input
const { Text, Title } = Typography

type KqlColumn = {
  name: string
  type: string
}

type KqlTable = {
  name: string
  columns: KqlColumn[]
  rows: Array<Array<string | number | boolean | null>>
}

type KqlResponse = {
  tables: KqlTable[]
  statistics?: Record<string, unknown>
}

type QueryHistoryItem = {
  id: string
  query: string
  timestamp: string
  timespan: string
}

type RowRecord = Record<string, string | number | boolean | null> & { key: string }

const defaultQuery = `requests
| summarize Requests=count(), Failed=countif(success == false) by bin(timestamp, 15m)
| order by timestamp asc`

const timeRanges = [
  { label: 'Last 1 hour', value: 'PT1H' },
  { label: 'Last 6 hours', value: 'PT6H' },
  { label: 'Last 24 hours', value: 'P1D' },
  { label: 'Last 7 days', value: 'P7D' },
  { label: 'Last 30 days', value: 'P30D' },
]

const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  const valueAsString = String(value)
  if (/[",\n]/.test(valueAsString)) {
    return `"${valueAsString.replaceAll('"', '""')}"`
  }

  return valueAsString
}

const downloadTextFile = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const resolveNumericColumn = (columns: KqlColumn[], rows: RowRecord[]): { label: string; value: number }[] => {
  const labelColumn = columns.find((column) => column.type === 'datetime' || column.type === 'string')
  const valueColumn = columns.find((column) => ['int', 'long', 'real', 'decimal'].includes(column.type))

  if (!labelColumn || !valueColumn) {
    return []
  }

  return rows
    .map((row) => ({ label: String(row[labelColumn.name] ?? 'n/a'), value: Number(row[valueColumn.name] ?? 0) }))
    .filter((point) => Number.isFinite(point.value))
}

function App() {
  const { message } = AntApp.useApp()
  const [appId, setAppId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [query, setQuery] = useState(defaultQuery)
  const [timespan, setTimespan] = useState('P1D')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<KqlResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [activeTab, setActiveTab] = useState('table')

  const selectedTable = response?.tables[0]

  const tableRows: RowRecord[] = useMemo(() => {
    if (!selectedTable) {
      return []
    }

    return selectedTable.rows.map((row, rowIndex) => {
      const mappedRow = selectedTable.columns.reduce<RowRecord>(
        (accumulator, column, columnIndex) => {
          accumulator[column.name] = row[columnIndex]
          return accumulator
        },
        { key: `${rowIndex}` },
      )

      return mappedRow
    })
  }, [selectedTable])

  const tableColumns: ColumnsType<RowRecord> = useMemo(() => {
    if (!selectedTable) {
      return []
    }

    return selectedTable.columns.map((column) => ({
      title: (
        <Space orientation="vertical" size={0}>
          <Text strong>{column.name}</Text>
          <Tag>{column.type}</Tag>
        </Space>
      ),
      dataIndex: column.name,
      key: column.name,
      sorter: (firstRow, secondRow) => String(firstRow[column.name] ?? '').localeCompare(String(secondRow[column.name] ?? '')),
      render: (value: unknown) => (value === null ? <Tag>null</Tag> : String(value)),
      ellipsis: true,
    }))
  }, [selectedTable])

  const chartPoints = useMemo(() => {
    if (!selectedTable) {
      return []
    }

    return resolveNumericColumn(selectedTable.columns, tableRows).slice(0, 30)
  }, [selectedTable, tableRows])

  const exportCsv = (): void => {
    if (!selectedTable) {
      return
    }

    const header = selectedTable.columns.map((column) => csvEscape(column.name)).join(',')
    const rows = selectedTable.rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\n')

    downloadTextFile('query-result.csv', `${header}\n${rows}`, 'text/csv;charset=utf-8')
  }

  const exportJson = (): void => {
    if (!response) {
      return
    }

    downloadTextFile('query-result.json', JSON.stringify(response, null, 2), 'application/json;charset=utf-8')
  }

  const executeQuery = async (): Promise<void> => {
    if (!appId.trim()) {
      setError('Application Insights App ID is required.')
      return
    }

    if (!query.trim()) {
      setError('KQL query is required.')
      return
    }

    if (!apiKey.trim() && !bearerToken.trim()) {
      setError('Provide an API key or bearer token to authenticate.')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const headers: Record<string, string> = {}
      if (apiKey.trim()) {
        headers['x-api-key'] = apiKey.trim()
      }
      if (bearerToken.trim()) {
        headers.Authorization = `Bearer ${bearerToken.trim()}`
      }

      const params = new URLSearchParams({
        query,
        timespan,
      })

      const apiResponse = await fetch(`https://api.applicationinsights.io/v1/apps/${encodeURIComponent(appId.trim())}/query?${params.toString()}`, {
        headers,
      })

      if (!apiResponse.ok) {
        const errorPayload = (await apiResponse.text()) || apiResponse.statusText
        throw new Error(errorPayload)
      }

      const payload = (await apiResponse.json()) as KqlResponse
      setResponse(payload)
      setActiveTab('table')
      setHistory((currentHistory) => [
        {
          id: `${Date.now()}`,
          query,
          timestamp: new Date().toISOString(),
          timespan,
        },
        ...currentHistory,
      ].slice(0, 10))
      message.success('Query executed successfully.')
    } catch (executionError) {
      const reason = executionError instanceof Error ? executionError.message : 'Unknown error'
      setError(`Query execution failed: ${reason}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout className="min-h-screen bg-slate-100">
      <Header className="!h-auto border-b border-slate-200 bg-white px-6 py-4">
        <Title level={3} className="!mb-1 !text-slate-900">
          Azure Application Insights KQL Dashboard
        </Title>
        <Text type="secondary">
          Run KQL queries and inspect results with table, chart, schema, statistics, JSON, and export support.
        </Text>
      </Header>
      <Content className="p-6">
        <Space direction="vertical" size="large" className="w-full">
          <Card>
            <Form layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Application Insights App ID" required>
                    <Input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="API Key">
                    <Input.Password value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Read API key" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Bearer Token">
                    <Input.Password value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} placeholder="AAD token" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="KQL Query" required>
                <TextArea value={query} onChange={(event) => setQuery(event.target.value)} autoSize={{ minRows: 5, maxRows: 14 }} />
              </Form.Item>
              <Row align="middle" justify="space-between" gutter={[12, 12]}>
                <Col>
                  <Space>
                    <Text type="secondary">Timespan</Text>
                    <Select value={timespan} options={timeRanges} onChange={setTimespan} className="w-48" />
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!selectedTable}>
                      Export CSV
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={exportJson} disabled={!response}>
                      Export JSON
                    </Button>
                    <Button icon={<PlayCircleOutlined />} type="primary" loading={isLoading} onClick={() => void executeQuery()}>
                      Run Query
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
            {error && (
              <Alert
                className="mt-4"
                type="error"
                showIcon
                message="Query Error"
                description={error}
              />
            )}
          </Card>

          <Row gutter={16}>
            <Col xs={24} xl={18}>
              <Space direction="vertical" size="middle" className="w-full">
                <Card>
                  <Row gutter={16}>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic title="Tables" value={response?.tables.length ?? 0} />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic title="Rows" value={tableRows.length} />
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic title="Columns" value={selectedTable?.columns.length ?? 0} />
                    </Col>
                  </Row>
                </Card>

                <Card styles={{ body: { paddingTop: 0 } }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                      {
                        key: 'table',
                        label: (
                          <span>
                            <TableOutlined /> Results Table
                          </span>
                        ),
                        children: selectedTable ? (
                          <Table
                            columns={tableColumns}
                            dataSource={tableRows}
                            scroll={{ x: true }}
                            pagination={{ pageSize: 25, showSizeChanger: true }}
                          />
                        ) : (
                          <Empty description="Run a query to view table results." />
                        ),
                      },
                      {
                        key: 'chart',
                        label: (
                          <span>
                            <AreaChartOutlined /> Quick Chart
                          </span>
                        ),
                        children: chartPoints.length > 0 ? (
                          <div className="space-y-3">
                            {chartPoints.map((point) => (
                              <div key={point.label} className="flex items-center gap-2">
                                <Text className="w-64 truncate">{point.label}</Text>
                                <div className="h-5 rounded bg-blue-500" style={{ width: `${Math.max(3, point.value)}px` }} />
                                <Text strong>{point.value}</Text>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty description="No plottable datetime/string + numeric columns found." />
                        ),
                      },
                      {
                        key: 'schema',
                        label: (
                          <span>
                            <UnorderedListOutlined /> Schema
                          </span>
                        ),
                        children: selectedTable ? (
                          <Table
                            pagination={false}
                            rowKey="name"
                            dataSource={selectedTable.columns}
                            columns={[
                              { title: 'Column', dataIndex: 'name' },
                              { title: 'Type', dataIndex: 'type' },
                            ]}
                          />
                        ) : (
                          <Empty description="Run a query to inspect schema." />
                        ),
                      },
                      {
                        key: 'statistics',
                        label: (
                          <span>
                            <HistoryOutlined /> Statistics
                          </span>
                        ),
                        children: response?.statistics ? (
                          <pre className="max-h-[440px] overflow-auto rounded bg-slate-900 p-4 text-slate-50">
                            {JSON.stringify(response.statistics, null, 2)}
                          </pre>
                        ) : (
                          <Empty description="No statistics returned for the current query." />
                        ),
                      },
                      {
                        key: 'json',
                        label: (
                          <span>
                            <CodeOutlined /> Raw JSON
                          </span>
                        ),
                        children: response ? (
                          <pre className="max-h-[440px] overflow-auto rounded bg-slate-900 p-4 text-slate-50">
                            {JSON.stringify(response, null, 2)}
                          </pre>
                        ) : (
                          <Empty description="Run a query to view raw JSON response." />
                        ),
                      },
                    ]}
                  />
                </Card>
              </Space>
            </Col>
            <Col xs={24} xl={6}>
              <Card title="Query History" extra={<Tag>{history.length}</Tag>}>
                {history.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No query history yet." />
                ) : (
                  <List
                    size="small"
                    dataSource={history}
                    renderItem={(historyItem) => (
                      <List.Item>
                        <Space orientation="vertical" size={0}>
                          <Button type="link" className="!p-0" onClick={() => setQuery(historyItem.query)}>
                            Reuse query
                          </Button>
                          <Text className="line-clamp-2 text-xs text-slate-700">{historyItem.query}</Text>
                          <Text type="secondary" className="text-xs">
                            {new Date(historyItem.timestamp).toLocaleString()} • {historyItem.timespan}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
                <Divider />
                <Descriptions size="small" column={1} title="Response Basics">
                  <Descriptions.Item label="Table Name">{selectedTable?.name ?? 'n/a'}</Descriptions.Item>
                  <Descriptions.Item label="Rows">{tableRows.length}</Descriptions.Item>
                  <Descriptions.Item label="Columns">{selectedTable?.columns.length ?? 0}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </Space>
      </Content>
    </Layout>
  )
}

export default App
