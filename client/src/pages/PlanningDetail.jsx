import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Loader2,
  Building2,
  Users,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X
} from 'lucide-react'

export default function PlanningDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [planning, setPlanning] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedChantiers, setExpandedChantiers] = useState({})
  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState({})
  const [editingChantier, setEditingChantier] = useState(null)
  const [medecins, setMedecins] = useState([])
  const [editForm, setEditForm] = useState({
    dateVisite: '',
    medecinId: ''
  })

  useEffect(() => {
    fetchPlanning()
    fetchMedecins()
  }, [id])

  const fetchPlanning = async () => {
    try {
      const response = await api.get(`/planning/${id}`)
      setPlanning(response.data.data)
    } catch (error) {
      toast.error('Erreur lors du chargement')
      navigate('/planning')
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

  const toggleChantier = (chantier) => {
    setExpandedChantiers(prev => ({
      ...prev,
      [chantier]: !prev[chantier]
    }))
  }

  const handleValidate = async () => {
    if (!confirm('Êtes-vous sûr de vouloir valider ce planning ? Les visites seront créées dans la base de données.')) {
      return
    }

    setValidating(true)
    try {
      const response = await api.post(`/planning/${id}/validate`)
      toast.success(response.data.message)
      fetchPlanning()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }

  const handleExportPdf = async (chantierName = null) => {
    const key = chantierName || 'all'
    setExporting(prev => ({ ...prev, [key]: true }))

    try {
      let url = `/export/planning/${id}/pdf`
      if (chantierName) {
        url = `/export/planning/${id}/chantier/${encodeURIComponent(chantierName)}/pdf`
      }

      const response = await api.get(url, { responseType: 'blob' })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = chantierName 
        ? `visite_${chantierName.replace(/\s+/g, '_')}.pdf`
        : `planning_${planning.nom.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast.success('PDF téléchargé')
    } catch (error) {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExporting(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleExportExcel = async () => {
    setExporting(prev => ({ ...prev, excel: true }))

    try {
      const response = await api.get(`/export/planning/${id}/excel`, { responseType: 'blob' })
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `planning_${planning.nom.replace(/\s+/g, '_')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast.success('Excel téléchargé')
    } catch (error) {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExporting(prev => ({ ...prev, excel: false }))
    }
  }

  const startEditChantier = (ch) => {
    setEditingChantier(ch.chantier)
    setEditForm({
      dateVisite: ch.dateVisite ? ch.dateVisite.split('T')[0] : '',
      medecinId: ch.medecinId?.toString() || ''
    })
  }

  const cancelEditChantier = () => {
    setEditingChantier(null)
    setEditForm({ dateVisite: '', medecinId: '' })
  }

  const saveChantierEdit = async (chantierName) => {
    try {
      const newData = { ...planning.data }
      const chantierIndex = newData.chantiers.findIndex(c => c.chantier === chantierName)
      
      if (chantierIndex !== -1) {
        newData.chantiers[chantierIndex].dateVisite = editForm.dateVisite
        newData.chantiers[chantierIndex].medecinId = editForm.medecinId ? parseInt(editForm.medecinId) : null
        
        const medecin = medecins.find(m => m.id === parseInt(editForm.medecinId))
        newData.chantiers[chantierIndex].medecinNom = medecin 
          ? `Dr. ${medecin.nom} ${medecin.prenom || ''}`.trim() 
          : null
      }

      await api.put(`/planning/${id}`, { data: newData })
      
      setPlanning(prev => ({ ...prev, data: newData }))
      toast.success('Chantier mis à jour')
      cancelEditChantier()
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!planning) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Planning non trouvé</p>
        <Link to="/planning" className="text-primary-600 hover:underline mt-2 block">
          Retour aux plannings
        </Link>
      </div>
    )
  }

  const isChantierFormat = planning.data?.chantiers !== undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/planning"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{planning.nom}</h1>
            <p className="text-gray-500">
              {format(new Date(planning.dateDebut), 'dd MMM yyyy', { locale: fr })} - 
              {format(new Date(planning.dateFin), 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {planning.status === 'BROUILLON' ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              <Clock className="w-4 h-4 mr-1" />
              Brouillon
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-4 h-4 mr-1" />
              Validé
            </span>
          )}
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-primary-50 to-primary-100">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-900">{planning.totalVisites}</p>
              <p className="text-sm text-primary-700">Visites planifiées</p>
            </div>
          </div>
        </div>

        {isChantierFormat && (
          <>
            <div className="card bg-gradient-to-br from-amber-50 to-amber-100">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white rounded-lg">
                  <Building2 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-900">{planning.data.chantiers.length}</p>
                  <p className="text-sm text-amber-700">Chantiers</p>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-green-100">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {Math.round((planning.totalVisites / 
                      planning.data.chantiers.reduce((sum, ch) => sum + (ch.totalDisponible || ch.salaries.length), 0)) * 100) || 100}%
                  </p>
                  <p className="text-sm text-green-700">Taux objectif</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="card flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={exporting.excel}
              className="btn-secondary flex items-center space-x-2"
            >
              {exporting.excel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExportPdf()}
              disabled={exporting.all}
              className="btn-secondary flex items-center space-x-2"
            >
              {exporting.all ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>PDF complet</span>
            </button>
          </div>

          {planning.status === 'BROUILLON' && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="btn-primary flex items-center space-x-2"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Valider</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenu du planning */}
      {isChantierFormat ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5" />
            <span>Planning par chantier</span>
          </h2>

          {planning.data.chantiers
            .sort((a, b) => b.salaries.length - a.salaries.length)
            .map((ch) => (
            <div key={ch.chantier} className="card p-0 overflow-hidden">
              {/* En-tête du chantier */}
              <div 
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleChantier(ch.chantier)}
              >
                <div className="flex items-center space-x-3">
                  {expandedChantiers[ch.chantier] ? 
                    <ChevronUp className="w-5 h-5 text-gray-400" /> : 
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  }
                  <div>
                    <p className="font-medium text-gray-900">{ch.chantier}</p>
                    <p className="text-sm text-gray-500">{ch.ville || 'Ville non définie'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {ch.dateVisite 
                          ? format(new Date(ch.dateVisite), 'dd/MM/yyyy')
                          : 'Non planifié'
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Stethoscope className="w-4 h-4" />
                      <span>{ch.medecinNom || 'Non assigné'}</span>
                    </div>
                  </div>
                  
                  {/* Objectif et taux */}
                  {ch.totalDisponible && ch.totalDisponible !== ch.salaries.length && (
                    <div className="text-center px-3 py-1 bg-amber-50 rounded-lg">
                      <p className="text-xs text-amber-600">Objectif</p>
                      <p className="font-semibold text-amber-700">
                        {ch.salaries.length}/{ch.totalDisponible}
                        <span className="text-xs ml-1">({ch.tauxObjectif}%)</span>
                      </p>
                    </div>
                  )}
                  
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                    {ch.salaries.length} salariés
                  </span>

                  <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                    {planning.status === 'BROUILLON' && (
                      <button
                        onClick={() => startEditChantier(ch)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleExportPdf(ch.chantier)}
                      disabled={exporting[ch.chantier]}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      title="Télécharger PDF"
                    >
                      {exporting[ch.chantier] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Formulaire de modification */}
              {editingChantier === ch.chantier && (
                <div className="p-4 bg-blue-50 border-t border-b border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Modifier le chantier</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label text-blue-800">Date de visite</label>
                      <input
                        type="date"
                        value={editForm.dateVisite}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dateVisite: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label text-blue-800">Médecin</label>
                      <select
                        value={editForm.medecinId}
                        onChange={(e) => setEditForm(prev => ({ ...prev, medecinId: e.target.value }))}
                        className="input"
                      >
                        <option value="">Sélectionner...</option>
                        {medecins.map(m => (
                          <option key={m.id} value={m.id}>
                            Dr. {m.nom} {m.prenom || ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={() => saveChantierEdit(ch.chantier)}
                        className="btn-primary flex items-center space-x-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Enregistrer</span>
                      </button>
                      <button
                        onClick={cancelEditChantier}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Annuler</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des salariés */}
              {expandedChantiers[ch.chantier] && (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">N°</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Matricule</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Fonction</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Type</th>
                        <th className="text-left py-2 px-4 font-medium text-gray-600">Dernière visite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ch.salaries.map((s, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-2 px-4 text-gray-500">{idx + 1}</td>
                          <td className="py-2 px-4 font-medium">{s.matricule}</td>
                          <td className="py-2 px-4 text-gray-600">{s.fonction || '-'}</td>
                          <td className="py-2 px-4 text-gray-600">{s.typeFonction || '-'}</td>
                          <td className="py-2 px-4">
                            {s.derniereVisite 
                              ? <span className="text-gray-600">{format(new Date(s.derniereVisite), 'dd/MM/yyyy')}</span>
                              : <span className="text-orange-600 font-medium">Jamais</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Ancien format - liste plate */
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">N°</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Matricule</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fonction</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Chantier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Ville</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Date visite</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Médecin</th>
                </tr>
              </thead>
              <tbody>
                {planning.data.map((v, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-4 font-medium">{v.matricule}</td>
                    <td className="py-2 px-4 text-gray-600">{v.fonction || '-'}</td>
                    <td className="py-2 px-4 text-gray-600">{v.chantier || '-'}</td>
                    <td className="py-2 px-4 text-gray-600">{v.ville || '-'}</td>
                    <td className="py-2 px-4">{format(new Date(v.dateVisite), 'dd/MM/yyyy')}</td>
                    <td className="py-2 px-4">{v.medecinNom || 'Non assigné'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
