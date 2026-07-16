import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Salaries from './pages/Salaries'
import Visites from './pages/Visites'
import Medecins from './pages/Medecins'
import Import from './pages/Import'
import Planning from './pages/Planning'
import PlanningDetail from './pages/PlanningDetail'
import PlanningCalendar from './pages/PlanningCalendar'
import Honoraires from './pages/Honoraires'
import KPI from './pages/KPI'
import Users from './pages/Users'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="salaries" element={<Salaries />} />
        <Route path="visites" element={<Visites />} />
        <Route path="medecins" element={<Medecins />} />
        <Route path="import" element={<Import />} />
        <Route path="planning" element={<Planning />} />
        <Route path="planning/calendrier" element={<PlanningCalendar />} />
        <Route path="planning/:id" element={<PlanningDetail />} />
        <Route path="honoraires" element={<Honoraires />} />
        <Route path="kpi" element={<KPI />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  )
}

export default App
