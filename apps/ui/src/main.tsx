import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { App as AntApp } from 'antd'
import 'antd/dist/reset.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardRouteComponent } from './routes/dashboard'
import './index.css'

const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT ?? 'http://localhost:4000/'

const client = new ApolloClient({
  uri: graphqlEndpoint,
  cache: new InMemoryCache(),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/dashboard" element={<DashboardRouteComponent />} />
            <Route path="*" element={<Navigate replace to="/dashboard" />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ApolloProvider>
  </StrictMode>,
)
