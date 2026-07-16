import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import {
  Users,
  Stethoscope,
  Calendar,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Clock,
  FileUp
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [visitesParMois, setVisitesParMois] = useState([])
  const [visitesParVille, setVisitesParVille] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, moisRes, villeRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/visites-par-mois'),
        api.get('/dashboard/visites-par-ville')
      ])
      
      setStats(statsRes.data.data)
      setVisitesParMois(moisRes.data.data)
      setVisitesParVille(villeRes.data.data.slice(0, 6))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Salariés',
      value: stats?.totalSalaries || 0,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Médecins actifs',
      value: stats?.totalMedecins || 0,
      icon: Stethoscope,
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    {
      title: 'À planifier',
      value: stats?.salariesAPlanifier || 0,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      link: '/import'
    },
    {
      title: 'Visites ce mois',
      value: stats?.visitesCeMois || 0,
      icon: Calendar,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble des visites médicales</p>
        </div>
        <Link to="/import" className="btn-primary flex items-center space-x-2">
          <FileUp className="w-5 h-5" />
          <span>Importer fichiers</span>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
            </div>
            {stat.link && (
              <Link to={stat.link} className="ml-auto text-primary-600 hover:text-primary-700">
                →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Coverage indicator */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Taux de couverture</h2>
          <span className="text-2xl font-bold text-primary-600">{stats?.tauxCouverture || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-primary-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${stats?.tauxCouverture || 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
            {stats?.salariesAJour || 0} à jour
          </span>
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1 text-orange-500" />
            {stats?.salariesAPlanifier || 0} à planifier
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits by month */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visites par mois</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitesParMois}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="effectuees" name="Effectuées" fill="#10b981" />
                <Bar dataKey="planifiees" name="Planifiées" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visits by city */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visites par ville</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visitesParVille}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="ville"
                  label={({ ville, percent }) => `${ville} (${(percent * 100).toFixed(0)}%)`}
                >
                  {visitesParVille.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Visites effectuées</p>
              <p className="text-3xl font-bold">{stats?.visitesEffectuees || 0}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-200" />
          </div>
        </div>
        
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Visites planifiées</p>
              <p className="text-3xl font-bold">{stats?.visitesPlanifiees || 0}</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-200" />
          </div>
        </div>
        
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total visites</p>
              <p className="text-3xl font-bold">{stats?.totalVisites || 0}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-200" />
          </div>
        </div>
      </div>
    </div>
  )
}
