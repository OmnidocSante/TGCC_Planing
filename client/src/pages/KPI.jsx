import { useState, useEffect } from 'react'
import api from '../services/api'
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Stethoscope,
  Calendar,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  PieChart,
  Activity
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

const PERIODES = [
  { value: 'mois', label: 'Ce mois' },
  { value: 'trimestre', label: 'Ce trimestre' },
  { value: 'annee', label: 'Cette année' },
  { value: 'custom', label: 'Personnalisé' }
]

export default function KPI() {
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('annee')
  const [dateDebut, setDateDebut] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'))
  const [dateFin, setDateFin] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'))
  const [villeFilter, setVilleFilter] = useState('')
  const [villes, setVilles] = useState([])
  
  // KPI Data
  const [stats, setStats] = useState({})
  const [visitesParMois, setVisitesParMois] = useState([])
  const [visitesParVille, setVisitesParVille] = useState([])
  const [visitesParStatut, setVisitesParStatut] = useState([])
  const [salariesParVille, setSalariesParVille] = useState([])
  const [salariesParStatut, setSalariesParStatut] = useState([])
  const [medecinPerformance, setMedecinPerformance] = useState([])
  const [chantierStats, setChantierStats] = useState([])
  const [honorairesStats, setHonorairesStats] = useState({})
  const [rentabilite, setRentabilite] = useState({ totaux: {}, parMedecin: [] })
  const [tendance, setTendance] = useState([])

  useEffect(() => {
    updateDateRange(periode)
  }, [periode])

  useEffect(() => {
    fetchAllKPIs()
  }, [dateDebut, dateFin, villeFilter])

  const updateDateRange = (p) => {
    const now = new Date()
    let start, end
    
    switch (p) {
      case 'mois':
        start = startOfMonth(now)
        end = endOfMonth(now)
        break
      case 'trimestre':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0)
        break
      case 'annee':
        start = startOfYear(now)
        end = endOfYear(now)
        break
      default:
        return
    }
    
    setDateDebut(format(start, 'yyyy-MM-dd'))
    setDateFin(format(end, 'yyyy-MM-dd'))
  }

  const fetchAllKPIs = async () => {
    setLoading(true)
    try {
      const params = { dateDebut, dateFin }
      if (villeFilter) params.ville = villeFilter

      const [
        statsRes,
        visitesParMoisRes,
        visitesParVilleRes,
        salariesRes,
        medecinsRes,
        honorairesRes,
        rentabiliteRes
      ] = await Promise.all([
        api.get('/kpi/stats', { params }),
        api.get('/kpi/visites-par-mois', { params }),
        api.get('/kpi/visites-par-ville', { params }),
        api.get('/kpi/salaries-stats', { params }),
        api.get('/kpi/medecins-performance', { params }),
        api.get('/kpi/honoraires-stats', { params }),
        api.get('/kpi/rentabilite-medecins', { params })
      ])

      setStats(statsRes.data.data)
      setVisitesParMois(visitesParMoisRes.data.data)
      setVisitesParVille(visitesParVilleRes.data.data)
      setSalariesParStatut(salariesRes.data.parStatut || [])
      setSalariesParVille(salariesRes.data.parVille || [])
      setVilles(salariesRes.data.villes || [])
      setMedecinPerformance(medecinsRes.data.data)
      setHonorairesStats(honorairesRes.data.data)
      setRentabilite(rentabiliteRes.data.data)
      
      // Calculer la tendance
      if (visitesParMoisRes.data.data.length > 1) {
        const trend = visitesParMoisRes.data.data.map((item, idx, arr) => {
          const prev = arr[idx - 1]
          return {
            ...item,
            variation: prev ? ((item.total - prev.total) / (prev.total || 1) * 100).toFixed(1) : 0
          }
        })
        setTendance(trend)
      }

    } catch (error) {
      console.error('Error fetching KPIs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMontant = (montant) => {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(montant || 0)
  }

  const KPICard = ({ title, value, subtitle, icon: Icon, color, trend, trendValue }) => (
    <div className={`card bg-gradient-to-br ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 bg-white/20 rounded-xl">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center mt-3 text-sm ${trendValue >= 0 ? 'text-green-200' : 'text-red-200'}`}>
          {trendValue >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          <span>{trendValue >= 0 ? '+' : ''}{trendValue}% vs période précédente</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord KPI</h1>
          <p className="text-gray-500 mt-1">Indicateurs clés de performance</p>
        </div>
        <button
          onClick={fetchAllKPIs}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-700">Filtres</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Période</label>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="input"
            >
              {PERIODES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => { setDateDebut(e.target.value); setPeriode('custom') }}
              className="input"
            />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => { setDateFin(e.target.value); setPeriode('custom') }}
              className="input"
            />
          </div>
          <div>
            <label className="label">Ville</label>
            <select
              value={villeFilter}
              onChange={(e) => setVilleFilter(e.target.value)}
              className="input"
            >
              <option value="">Toutes les villes</option>
              {villes.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setPeriode('annee'); setVilleFilter('') }}
              className="btn-secondary w-full"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* KPIs principaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Salariés"
              value={stats.totalSalaries?.toLocaleString() || 0}
              subtitle={`${stats.salariesActifs || 0} actifs`}
              icon={Users}
              color="from-blue-500 to-blue-600 text-white"
            />
            <KPICard
              title="Visites Effectuées"
              value={stats.visitesEffectuees?.toLocaleString() || 0}
              subtitle={`${stats.visitesPlanifiees || 0} planifiées`}
              icon={Calendar}
              color="from-green-500 to-green-600 text-white"
            />
            <KPICard
              title="Taux de Couverture"
              value={`${stats.tauxCouverture || 0}%`}
              subtitle={`${stats.salariesAJour || 0} à jour`}
              icon={CheckCircle}
              color="from-purple-500 to-purple-600 text-white"
            />
            <KPICard
              title="À Planifier"
              value={stats.salariesAPlanifier?.toLocaleString() || 0}
              subtitle="Visites > 12 mois"
              icon={AlertTriangle}
              color="from-orange-500 to-orange-600 text-white"
            />
          </div>

          {/* KPIs secondaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Médecins Actifs"
              value={stats.totalMedecins || 0}
              icon={Stethoscope}
              color="from-cyan-500 to-cyan-600 text-white"
            />
            <KPICard
              title="Chantiers"
              value={stats.totalChantiers || 0}
              icon={Building2}
              color="from-amber-500 to-amber-600 text-white"
            />
            <KPICard
              title="Villes Couvertes"
              value={stats.totalVilles || 0}
              icon={MapPin}
              color="from-pink-500 to-pink-600 text-white"
            />
            <KPICard
              title="Honoraires Total"
              value={formatMontant(honorairesStats.montantTotal)}
              subtitle={`${honorairesStats.nbHonoraires || 0} factures`}
              icon={DollarSign}
              color="from-emerald-500 to-emerald-600 text-white"
            />
          </div>

          {/* Rentabilité - CA, Honoraires, Marge */}
          <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>Rentabilité globale (230 DH / visite effectuée)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">Visites effectuées</p>
                <p className="text-2xl font-bold text-gray-900">{rentabilite.totaux.nbVisites?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-blue-600">{formatMontant(rentabilite.totaux.chiffreAffaire || 0)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">Charges (Honoraires)</p>
                <p className="text-2xl font-bold text-red-600">{formatMontant(rentabilite.totaux.honoraires || 0)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">Marge nette</p>
                <p className={`text-2xl font-bold ${(rentabilite.totaux.marge || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMontant(rentabilite.totaux.marge || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Taux de marge: {rentabilite.totaux.tauxMarge || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Tableau rentabilité par médecin */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <span>Rentabilité par médecin</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Médecin</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Visites</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CA (230 DH/visite)</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Honoraires</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Marge</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilite.parMedecin.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">Aucune donnée</td>
                    </tr>
                  ) : (
                    rentabilite.parMedecin.map((m, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">Dr. {m.nom} {m.prenom || ''}</td>
                        <td className="py-3 px-4 text-right">{m.nbVisites}</td>
                        <td className="py-3 px-4 text-right text-blue-600 font-medium">
                          {formatMontant(m.chiffreAffaire)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {formatMontant(m.honoraires)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${m.marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMontant(m.marge)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            m.tauxMarge >= 50 ? 'bg-green-100 text-green-700' :
                            m.tauxMarge >= 20 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {m.tauxMarge}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {rentabilite.parMedecin.length > 0 && (
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td className="py-3 px-4">TOTAL</td>
                      <td className="py-3 px-4 text-right">{rentabilite.totaux.nbVisites}</td>
                      <td className="py-3 px-4 text-right text-blue-600">{formatMontant(rentabilite.totaux.chiffreAffaire)}</td>
                      <td className="py-3 px-4 text-right text-red-600">{formatMontant(rentabilite.totaux.honoraires)}</td>
                      <td className={`py-3 px-4 text-right ${rentabilite.totaux.marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatMontant(rentabilite.totaux.marge)}
                      </td>
                      <td className="py-3 px-4 text-right">{rentabilite.totaux.tauxMarge}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Graphiques ligne 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Évolution des visites */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-primary-600" />
                <span>Évolution des visites</span>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={visitesParMois}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="effectuees" name="Effectuées" stroke="#10B981" fill="#10B98133" />
                  <Area type="monotone" dataKey="planifiees" name="Planifiées" stroke="#3B82F6" fill="#3B82F633" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Répartition par ville */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                <span>Visites par ville (Top 10)</span>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visitesParVille.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="ville" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" name="Visites" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graphiques ligne 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Statut des salariés */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-primary-600" />
                <span>Statut des salariés</span>
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={[
                      { name: 'À jour', value: stats.salariesAJour || 0 },
                      { name: 'À planifier', value: stats.salariesAPlanifier || 0 }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#F59E0B" />
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Honoraires par statut */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                <span>Honoraires par statut</span>
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={honorairesStats.parStatut || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="montant"
                    label={({ statut, percent }) => `${statut} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(honorairesStats.parStatut || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMontant(value)} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Salariés par ville */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary-600" />
                <span>Salariés par ville (Top 5)</span>
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salariesParVille.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ville" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Salariés" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance des médecins */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-primary-600" />
              <span>Performance des médecins</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Médecin</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Visites</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Examens</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Honoraires</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Coût/Examen</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Villes</th>
                  </tr>
                </thead>
                <tbody>
                  {medecinPerformance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">Aucune donnée</td>
                    </tr>
                  ) : (
                    medecinPerformance.map((m, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">Dr. {m.nom} {m.prenom || ''}</td>
                        <td className="py-3 px-4 text-right">{m.nbVisites || 0}</td>
                        <td className="py-3 px-4 text-right">{m.nbExamens || 0}</td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          {formatMontant(m.totalHonoraires)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {m.nbExamens > 0 ? formatMontant(m.totalHonoraires / m.nbExamens) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(m.villes || []).slice(0, 3).map((v, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {v}
                              </span>
                            ))}
                            {(m.villes || []).length > 3 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                +{m.villes.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Indicateurs supplémentaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <Clock className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.delaiMoyenJours || 0}</p>
              <p className="text-sm text-gray-500">Délai moyen entre visites (jours)</p>
            </div>
            <div className="card text-center">
              <Activity className="w-8 h-8 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.visitesCeMois || 0}</p>
              <p className="text-sm text-gray-500">Visites ce mois</p>
            </div>
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats.nbExamens > 0 ? formatMontant(honorairesStats.montantTotal / (stats.nbExamens || 1)) : '-'}
              </p>
              <p className="text-sm text-gray-500">Coût moyen par examen</p>
            </div>
            <div className="card text-center">
              <Building2 className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stats.planningsValides || 0}</p>
              <p className="text-sm text-gray-500">Plannings validés</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
