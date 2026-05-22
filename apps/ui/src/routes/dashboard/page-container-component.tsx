import { Card, Layout, Typography } from 'antd'
import { DashboardPageComponent } from './page-component'

const { Header, Content } = Layout
const { Title, Text } = Typography

export const DashboardPageContainerComponent = () => (
  <Layout className="min-h-screen bg-slate-100">
    <Header className="!h-auto border-b border-slate-200 bg-white px-6 py-4">
      <Title level={3} className="!mb-1">
        App Insights Dashboard
      </Title>
      <Text type="secondary">Route-level package using page-container-component model.</Text>
    </Header>
    <Content className="p-6">
      <Card>
        <DashboardPageComponent />
      </Card>
    </Content>
  </Layout>
)
