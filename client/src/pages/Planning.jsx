import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardList,
  Plus,
  Calendar,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  Loader2,
  Building2,
  Users,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  FileDown,
  MapPin
} from 'lucide-react'

export default function Planning() {
  const [plannings, setPlannings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [medecins, setMedecins] = useState([])
  const [salariesAPlanifier, setSalariesAPlanifier] = useState([])
  const [groupedByVille, setGroupedByVille] = useState({})
  const [chantierAssignments, setChantierAssignments] = useState({})
  const [chantierDates, setChantierDates] = useState({})
  const [chantierObjectifs, setChantierObjectifs] = useState({})
  const [chantierSelected, setChantierSelected] = useState({})
  const [expandedVilles, setExpandedVilles] = useState({})
  const [expandedChantiers, setExpandedChantiers] = useState({})
  const [stats, setStats] = useState({ totalSalaries: 0, totalAPlanifier: 0, tauxCouverture: 0 })
  const [formData, setFormData] = useState({
    nom: '',
    dateDebut: format(new Date(), 'yyyy-MM-dd'),
    dateFin: format(addDays(new Date(), 30), 'yyyy-MM-dd')
  })
  
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    fetchPlannings()
    fetchMedecins()
    fetchStats()
    
    if (location.state?.fromImport && location.state?.salarieIds) {
      fetchSalariesAPlanifier(location.state.salarieIds)
      setShowModal(true)
    }
  }, [location])

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats')
      setStats({
        totalSalaries: response.data.data.totalSalaries,
        totalAPlanifier: response.data.data.salariesAPlanifier,
        tauxCouverture: response.data.data.tauxCouverture
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchPlannings = async () => {
    try {
      const response = await api.get('/planning')
      setPlannings(response.data.data)
    } catch (error) {
      console.error('Error fetching plannings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMedecins = async () => {
    try {
      const response = await api.get('/medecins')
      setMedecins(response.data.data)
    } catch (error) {
      console.error('Error fetching medecins:', error)
    }
  }

  const fetchSalariesAPlanifier = async (salarieIds) => {
    try {
      const response = await api.get('/dashboard/a-planifier', {
        params: { limit: 10000 }
      })
      
      let salaries = response.data.data
      if (salarieIds && salarieIds.length > 0) {
        salaries = salaries.filter(s => salarieIds.includes(s.id))
      }
      
      setSalariesAPlanifier(salaries)
      
      // Grouper par ville puis par chantier
      const grouped = salaries.reduce((acc, s) => {
        const ville = s.ville || 'VILLE NON DÉFINIE'
        const chantier = s.chantier || 'SANS CHANTIER'
        
        if (!acc[ville]) {
          acc[ville] = {
            chantiers: {},
            totalSalaries: 0
          }
        }
        
        if (!acc[ville].chantiers[chantier]) {
          acc[ville].chantiers[chantier] = {
            salaries: [],
            count: 0
          }
        }
        
        acc[ville].chantiers[chantier].salaries.push(s)
        acc[ville].chantiers[chantier].count++
        acc[ville].totalSalaries++
        
        return acc
      }, {})
      
      setGroupedByVille(grouped)
      
      // Initialiser les dates, assignations, objectifs et sélection par chantier
      const dates = {}
      const assignments = {}
      const objectifs = {}
      const selected = {}
      Object.entries(grouped).forEach(([ville, villeData]) => {
        Object.keys(villeData.chantiers).forEach(chantier => {
          const key = `${ville}|||${chantier}`
          dates[key] = format(new Date(), 'yyyy-MM-dd')
          assignments[key] = ''
          objectifs[key] = villeData.chantiers[chantier].count // Par défaut, objectif = tous les salariés
          selected[key] = false // Par défaut, non sélectionné
        })
      })
      setChantierDates(dates)
      setChantierAssignments(assignments)
      setChantierObjectifs(objectifs)
      setChantierSelected(selected)
      
      // Ouvrir toutes les villes par défaut
      const expandedV = {}
      Object.keys(grouped).forEach(ville => {
        expandedV[ville] = true
      })
      setExpandedVilles(expandedV)
      
    } catch (error) {
      console.error('Error fetching salaries:', error)
    }
  }

  const handleGenerate = async () => {
    if (!formData.nom) {
      toast.error('Veuillez donner un nom au planning')
      return
    }

    setGenerating(true)

    // Vérifier qu'au moins un chantier est sélectionné
    const selectedCount = Object.values(chantierSelected).filter(Boolean).length
    if (selectedCount === 0) {
      toast.error('Veuillez sélectionner au moins un chantier')
      return
    }

    try {
      // Préparer les données du planning - seulement les chantiers sélectionnés
      const chantiersList = []
      
      Object.entries(groupedByVille).forEach(([ville, villeData]) => {
        Object.entries(villeData.chantiers).forEach(([chantier, chantierData]) => {
          const key = `${ville}|||${chantier}`
          
          // Ignorer les chantiers non sélectionnés
          if (!chantierSelected[key]) return
          
          const objectif = parseInt(chantierObjectifs[key]) || chantierData.count
          // Limiter les salariés à l'objectif défini
          const salariesToInclude = chantierData.salaries.slice(0, objectif)
          chantiersList.push({
            chantier,
            ville,
            medecinId: chantierAssignments[key] ? parseInt(chantierAssignments[key]) : null,
            dateVisite: chantierDates[key],
            objectif: objectif,
            totalDisponible: chantierData.count,
            salarieIds: salariesToInclude.map(s => s.id)
          })
        })
      })

      const planningData = {
        nom: formData.nom,
        dateDebut: formData.dateDebut,
        dateFin: formData.dateFin,
        chantiers: chantiersList
      }

      const response = await api.post('/planning/generate-by-chantier', planningData)
      toast.success(response.data.message)
      setShowModal(false)
      navigate(`/planning/${response.data.data.id}`)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id, status) => {
    const message = status === 'VALIDE'
      ? '⚠️ Ce planning est VALIDÉ. Les visites associées seront également supprimées. Êtes-vous sûr ?'
      : 'Êtes-vous sûr de vouloir supprimer ce planning ?'
    
    if (!confirm(message)) return

    try {
      await api.delete(`/planning/${id}`)
      toast.success('Planning supprimé')
      fetchPlannings()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const toggleVille = (ville) => {
    setExpandedVilles(prev => ({
      ...prev,
      [ville]: !prev[ville]
    }))
  }

  const toggleChantier = (key) => {
    setExpandedChantiers(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VALIDE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Validé
          </span>
        )
      case 'BROUILLON':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Brouillon
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const getMedecinForVille = (ville) => {
    return medecins.filter(m => {
      const villes = m.villes || []
      return villes.some(v => 
        v.toUpperCase().includes(ville?.toUpperCase() || '') ||
        ville?.toUpperCase().includes(v.toUpperCase())
      )
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plannings</h1>
          <p className="text-gray-500 mt-1">Gérez les plannings de visites médicales par chantier</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/planning/calendrier"
            className="btn-secondary flex items-center space-x-2"
          >
            <CalendarDays className="w-5 h-5" />
            <span>Calendrier</span>
          </Link>
          <button
            onClick={() => {
              fetchSalariesAPlanifier(null)
              setShowModal(true)
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau planning</span>
          </button>
        </div>
      </div>

      {/* Stats de couverture */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-200 rounded-lg">
              <Users className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{stats.totalSalaries}</p>
              <p className="text-xs text-blue-700">Total salariés</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-200 rounded-lg">
              <Clock className="w-5 h-5 text-orange-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-900">{stats.totalAPlanifier}</p>
              <p className="text-xs text-orange-700">À planifier</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-900">{stats.totalSalaries - stats.totalAPlanifier}</p>
              <p className="text-xs text-green-700">À jour</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-200 rounded-lg">
              <ClipboardList className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-900">{stats.tauxCouverture}%</p>
              <p className="text-xs text-purple-700">Taux de couverture</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : plannings.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun planning</h3>
          <p className="text-gray-500 mb-6">Commencez par créer un nouveau planning de visites</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            Créer un planning
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plannings.map((planning) => (
            <div key={planning.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{planning.nom}</h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(planning.dateDebut), 'dd MMM yyyy', { locale: fr })} - {format(new Date(planning.dateFin), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{planning.totalVisites}</p>
                    <p className="text-xs text-gray-500">visites</p>
                  </div>

                  {getStatusBadge(planning.status)}

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/planning/${planning.id}`}
                      className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <button
                        onClick={() => handleDelete(planning.id, planning.status)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer le planning"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Planning par chantier */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen px-4 pt-10 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Créer un planning par chantier
              </h2>
              
              {/* Résumé des stats */}
              <div className="mb-4 grid grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{salariesAPlanifier.length}</p>
                  <p className="text-xs text-blue-600">Salariés disponibles</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-700">
                    {Object.values(chantierSelected).filter(Boolean).length}
                  </p>
                  <p className="text-xs text-purple-600">Chantiers sélectionnés</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-700">
                    {Object.entries(chantierObjectifs)
                      .filter(([key]) => chantierSelected[key])
                      .reduce((a, [, b]) => a + (parseInt(b) || 0), 0)}
                  </p>
                  <p className="text-xs text-amber-600">Objectif sélectionné</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {salariesAPlanifier.length > 0 
                      ? Math.round((Object.entries(chantierObjectifs)
                          .filter(([key]) => chantierSelected[key])
                          .reduce((a, [, b]) => a + (parseInt(b) || 0), 0) / salariesAPlanifier.length) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-green-600">Taux objectif</p>
                </div>
              </div>
              
              {/* Boutons de sélection rapide */}
              <div className="mb-4 flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const newSelected = {}
                    Object.keys(chantierSelected).forEach(key => newSelected[key] = true)
                    setChantierSelected(newSelected)
                  }}
                  className="btn-secondary text-sm"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newSelected = {}
                    Object.keys(chantierSelected).forEach(key => newSelected[key] = false)
                    setChantierSelected(newSelected)
                  }}
                  className="btn-secondary text-sm"
                >
                  Tout désélectionner
                </button>
              </div>

              {location.state?.fromImport && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-700">
                    Import depuis fichier client
                  </p>
                </div>
              )}

              {/* Étape 1: Nom du planning */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="label">Nom du planning *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="input"
                  placeholder="Planning Juillet 2026 - Chantiers CASA"
                />
              </div>

              {/* Liste des villes et chantiers */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Villes ({Object.keys(groupedByVille).length}) - Chantiers ({
                    Object.values(groupedByVille).reduce((acc, v) => acc + Object.keys(v.chantiers).length, 0)
                  })</span>
                </h3>

                {Object.entries(groupedByVille)
                  .sort((a, b) => b[1].totalSalaries - a[1].totalSalaries)
                  .map(([ville, villeData]) => (
                  <div key={ville} className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* En-tête de la ville */}
                    <div 
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 to-primary-100 cursor-pointer hover:from-primary-100 hover:to-primary-200"
                      onClick={() => toggleVille(ville)}
                    >
                      <div className="flex items-center space-x-3">
                        {expandedVilles[ville] ? 
                          <ChevronUp className="w-5 h-5 text-primary-600" /> : 
                          <ChevronDown className="w-5 h-5 text-primary-600" />
                        }
                        <MapPin className="w-5 h-5 text-primary-600" />
                        <div>
                          <p className="font-semibold text-primary-900">{ville}</p>
                          <p className="text-sm text-primary-700">
                            {Object.keys(villeData.chantiers).length} chantier(s)
                          </p>
                        </div>
                      </div>
                      <span className="px-4 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium">
                        {villeData.totalSalaries} salariés
                      </span>
                    </div>

                    {/* Chantiers de cette ville */}
                    {expandedVilles[ville] && (
                      <div className="divide-y divide-gray-200">
                        {Object.entries(villeData.chantiers)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([chantier, chantierData]) => {
                            const key = `${ville}|||${chantier}`
                            return (
                              <div key={chantier} className="bg-white">
                                {/* En-tête du chantier */}
                                <div 
                                  className={`flex items-center justify-between p-3 pl-6 cursor-pointer transition-colors ${
                                    chantierSelected[key] 
                                      ? 'bg-green-50 hover:bg-green-100' 
                                      : 'bg-gray-50 hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    {/* Checkbox de sélection */}
                                    <input
                                      type="checkbox"
                                      checked={chantierSelected[key] || false}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        setChantierSelected(prev => ({
                                          ...prev,
                                          [key]: e.target.checked
                                        }))
                                      }}
                                      className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                    />
                                    <div 
                                      className="flex items-center space-x-2 cursor-pointer"
                                      onClick={() => toggleChantier(key)}
                                    >
                                      {expandedChantiers[key] ? 
                                        <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                      }
                                      <Building2 className="w-4 h-4 text-gray-500" />
                                      <p className="font-medium text-gray-800">{chantier}</p>
                                    </div>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    chantierSelected[key]
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {chantierData.count} salariés
                                  </span>
                                </div>

                                {/* Configuration du chantier - visible seulement si sélectionné */}
                                {chantierSelected[key] && (
                                  <div className="p-4 pl-10 bg-green-50/50 border-t border-green-100">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {/* Objectif de personnes */}
                                      <div>
                                        <label className="label flex items-center space-x-1 text-sm">
                                          <Users className="w-4 h-4" />
                                          <span>Objectif à voir</span>
                                        </label>
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="number"
                                            min="1"
                                            max={chantierData.count}
                                            value={chantierObjectifs[key] || chantierData.count}
                                            onChange={(e) => setChantierObjectifs(prev => ({
                                              ...prev,
                                              [key]: Math.min(parseInt(e.target.value) || 1, chantierData.count)
                                            }))}
                                            className="input text-sm w-20"
                                          />
                                          <span className="text-sm text-gray-500">/ {chantierData.count}</span>
                                          <span className="text-xs text-gray-400">
                                            ({Math.round(((chantierObjectifs[key] || chantierData.count) / chantierData.count) * 100)}%)
                                          </span>
                                        </div>
                                      </div>

                                      {/* Sélection du médecin */}
                                      <div>
                                        <label className="label flex items-center space-x-1 text-sm">
                                          <Stethoscope className="w-4 h-4" />
                                          <span>Médecin assigné</span>
                                        </label>
                                        <select
                                          value={chantierAssignments[key] || ''}
                                          onChange={(e) => setChantierAssignments(prev => ({
                                            ...prev,
                                            [key]: e.target.value
                                          }))}
                                          className="input text-sm"
                                        >
                                          <option value="">Sélectionner un médecin...</option>
                                          {getMedecinForVille(ville).length > 0 && (
                                            <optgroup label={`Médecins recommandés (${ville})`}>
                                              {getMedecinForVille(ville).map(m => (
                                                <option key={m.id} value={m.id}>
                                                  Dr. {m.nom} {m.prenom || ''}
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                          <optgroup label="Tous les médecins">
                                            {medecins.map(m => (
                                              <option key={m.id} value={m.id}>
                                                Dr. {m.nom} {m.prenom || ''}
                                              </option>
                                            ))}
                                          </optgroup>
                                        </select>
                                      </div>

                                      {/* Date de visite */}
                                      <div>
                                        <label className="label flex items-center space-x-1 text-sm">
                                          <Calendar className="w-4 h-4" />
                                          <span>Date de visite</span>
                                        </label>
                                        <input
                                          type="date"
                                          value={chantierDates[key] || ''}
                                          onChange={(e) => setChantierDates(prev => ({
                                            ...prev,
                                            [key]: e.target.value
                                          }))}
                                          className="input text-sm"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Liste des salariés (expandable) */}
                                {expandedChantiers[key] && (
                                  <div className="border-t border-gray-200 max-h-48 overflow-y-auto bg-gray-50">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                          <th className="text-left py-2 px-4 font-medium text-gray-500">Matricule</th>
                                          <th className="text-left py-2 px-4 font-medium text-gray-500">Fonction</th>
                                          <th className="text-left py-2 px-4 font-medium text-gray-500">Dernière visite</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {chantierData.salaries.map((s, idx) => (
                                          <tr key={idx} className="border-t border-gray-100 bg-white">
                                            <td className="py-2 px-4 font-medium">{s.matricule}</td>
                                            <td className="py-2 px-4 text-gray-600">{s.fonction || '-'}</td>
                                            <td className="py-2 px-4 text-gray-600">
                                              {s.derniereVisite 
                                                ? format(new Date(s.derniereVisite), 'dd/MM/yyyy')
                                                : <span className="text-orange-600">Jamais</span>
                                              }
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !formData.nom}
                  className="btn-primary flex items-center space-x-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Génération...</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-5 h-5" />
                      <span>Générer le planning</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
