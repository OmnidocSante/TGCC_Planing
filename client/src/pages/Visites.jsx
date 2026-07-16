import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const STATUTS = [
  { value: 'PLANIFIEE', label: 'Planifiée', color: 'bg-blue-100 text-blue-700', icon: Clock },
  { value: 'EFFECTUEE', label: 'Effectuée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'ANNULEE', label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle },
  { value: 'REPORTEE', label: 'Reportée', color: 'bg-yellow-100 text-yellow-700', icon: RefreshCw }
]

export default function Visites() {
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filters, setFilters] = useState({ statut: '', dateDebut: '', dateFin: '', matricule: '' })
  const [showModal, setShowModal] = useState(false)
  const [editingVisite, setEditingVisite] = useState(null)
  const [salaries, setSalaries] = useState([])
  const [medecins, setMedecins] = useState([])
  const [searchSalarie, setSearchSalarie] = useState('')
  const [formData, setFormData] = useState({
    salarieId: '',
    medecinId: '',
    dateVisite: format(new Date(), 'yyyy-MM-dd'),
    chantier: '',
    ville: '',
    statut: 'PLANIFIEE',
    notes: ''
  })

  useEffect(() => {
    fetchVisites()
    fetchMedecins()
  }, [pagination.page, filters])

  const fetchVisites = async () => {
    setLoading(true)
    try {
      const params = { page: pagination.page, limit: 20 }
      if (filters.statut) params.statut = filters.statut
      if (filters.dateDebut) params.dateDebut = filters.dateDebut
      if (filters.dateFin) params.dateFin = filters.dateFin
      if (filters.matricule) params.matricule = filters.matricule

      const response = await api.get('/visites', { params })
      setVisites(response.data.data)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching visites:', error)
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

  const searchSalaries = async (query) => {
    if (query.length < 2) {
      setSalaries([])
      return
    }
    try {
      const response = await api.get('/salaries/search', { params: { q: query } })
      setSalaries(response.data.data)
    } catch (error) {
      console.error('Error searching salaries:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingVisite) {
        await api.put(`/visites/${editingVisite.id}`, formData)
        toast.success('Visite mise à jour')
      } else {
        await api.post('/visites', formData)
        toast.success('Visite créée')
      }
      setShowModal(false)
      setEditingVisite(null)
      resetForm()
      fetchVisites()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur')
    }
  }

  const handleEdit = (visite) => {
    setEditingVisite(visite)
    setFormData({
      salarieId: visite.salarieId,
      medecinId: visite.medecinId || '',
      dateVisite: format(new Date(visite.dateVisite), 'yyyy-MM-dd'),
      chantier: visite.chantier || '',
      ville: visite.ville || '',
      statut: visite.statut,
      notes: visite.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette visite ?')) return
    try {
      await api.delete(`/visites/${id}`)
      toast.success('Visite supprimée')
      fetchVisites()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const resetForm = () => {
    setFormData({
      salarieId: '',
      medecinId: '',
      dateVisite: format(new Date(), 'yyyy-MM-dd'),
      chantier: '',
      ville: '',
      statut: 'PLANIFIEE',
      notes: ''
    })
    setSearchSalarie('')
    setSalaries([])
  }

  const getStatutBadge = (statut) => {
    const s = STATUTS.find(st => st.value === statut) || STATUTS[0]
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {s.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visites médicales</h1>
          <p className="text-gray-500 mt-1">{pagination.total} visites au total</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingVisite(null); setShowModal(true) }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle visite</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-700">Filtres</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Recherche matricule</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.matricule}
                onChange={(e) => setFilters({ ...filters, matricule: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchVisites() }}
                className="input pl-10"
                placeholder="Ex: 1108702"
              />
            </div>
          </div>
          <div>
            <label className="label">Statut</label>
            <select
              value={filters.statut}
              onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
              className="input"
            >
              <option value="">Tous les statuts</option>
              {STATUTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date début</label>
            <input
              type="date"
              value={filters.dateDebut}
              onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input
              type="date"
              value={filters.dateFin}
              onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ statut: '', dateDebut: '', dateFin: '', matricule: '' })}
              className="btn-secondary w-full"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Salarié</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Médecin</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Chantier</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ville</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">Chargement...</td>
                </tr>
              ) : visites.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">Aucune visite trouvée</td>
                </tr>
              ) : (
                visites.map((visite) => (
                  <tr key={visite.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {format(new Date(visite.dateVisite), 'dd MMM yyyy', { locale: fr })}
                      </div>
                      {visite.dateVisiteProchaine && (
                        <div className="text-xs text-gray-400">
                          Prochaine: {format(new Date(visite.dateVisiteProchaine), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{visite.salarie.matricule}</div>
                      <div className="text-sm text-gray-500">{visite.salarie.fonction || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {visite.medecin ? `Dr. ${visite.medecin.nom}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{visite.chantier || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{visite.ville || '-'}</td>
                    <td className="py-3 px-4">{getStatutBadge(visite.statut)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleEdit(visite)} className="p-1 text-gray-600 hover:text-primary-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(visite.id)} className="p-1 text-gray-600 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">Page {pagination.page} sur {pagination.totalPages}</p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="btn-secondary p-2 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary p-2 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingVisite ? 'Modifier la visite' : 'Nouvelle visite'}
                </h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingVisite && (
                  <div>
                    <label className="label">Rechercher un salarié *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchSalarie}
                        onChange={(e) => {
                          setSearchSalarie(e.target.value)
                          searchSalaries(e.target.value)
                        }}
                        className="input"
                        placeholder="Matricule ou nom..."
                      />
                      {salaries.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {salaries.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, salarieId: s.id, chantier: s.chantier || '', ville: s.ville || '' })
                                setSearchSalarie(`${s.matricule} - ${s.fonction || ''}`)
                                setSalaries([])
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100"
                            >
                              <div className="font-medium">{s.matricule}</div>
                              <div className="text-sm text-gray-500">{s.fonction || 'Pas de fonction'}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de visite *</label>
                    <input
                      type="date"
                      value={formData.dateVisite}
                      onChange={(e) => setFormData({ ...formData, dateVisite: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Médecin</label>
                    <select
                      value={formData.medecinId}
                      onChange={(e) => setFormData({ ...formData, medecinId: e.target.value })}
                      className="input"
                    >
                      <option value="">Sélectionner...</option>
                      {medecins.map(m => (
                        <option key={m.id} value={m.id}>Dr. {m.nom} {m.prenom || ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Chantier</label>
                    <input
                      type="text"
                      value={formData.chantier}
                      onChange={(e) => setFormData({ ...formData, chantier: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Ville</label>
                    <input
                      type="text"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Statut</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="input"
                  >
                    {STATUTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows="3"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary" disabled={!editingVisite && !formData.salarieId}>
                    {editingVisite ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
