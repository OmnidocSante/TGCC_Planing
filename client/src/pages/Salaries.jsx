import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X
} from 'lucide-react'

export default function Salaries() {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [showModal, setShowModal] = useState(false)
  const [editingSalarie, setEditingSalarie] = useState(null)
  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    fonction: '',
    typeFonction: '',
    chantier: '',
    ville: ''
  })

  useEffect(() => {
    if (search.length >= 2) {
      searchSalaries()
    } else {
      fetchSalaries()
    }
  }, [pagination.page, search])

  const fetchSalaries = async () => {
    setLoading(true)
    try {
      const response = await api.get('/salaries', {
        params: { page: pagination.page, limit: 20 }
      })
      setSalaries(response.data.data)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching salaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchSalaries = async () => {
    setLoading(true)
    try {
      const response = await api.get('/salaries/search', {
        params: { q: search }
      })
      setSalaries(response.data.data)
      setPagination({ page: 1, totalPages: 1, total: response.data.data.length })
    } catch (error) {
      console.error('Error searching salaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSalarie) {
        await api.put(`/salaries/${editingSalarie.id}`, formData)
        toast.success('Salarié mis à jour')
      } else {
        await api.post('/salaries', formData)
        toast.success('Salarié créé')
      }
      setShowModal(false)
      setEditingSalarie(null)
      resetForm()
      fetchSalaries()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur')
    }
  }

  const handleEdit = (salarie) => {
    setEditingSalarie(salarie)
    setFormData({
      matricule: salarie.matricule,
      nom: salarie.nom || '',
      prenom: salarie.prenom || '',
      fonction: salarie.fonction || '',
      typeFonction: salarie.typeFonction || '',
      chantier: salarie.chantier || '',
      ville: salarie.ville || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce salarié ?')) return
    try {
      await api.delete(`/salaries/${id}`)
      toast.success('Salarié supprimé')
      fetchSalaries()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const resetForm = () => {
    setFormData({
      matricule: '',
      nom: '',
      prenom: '',
      fonction: '',
      typeFonction: '',
      chantier: '',
      ville: ''
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salariés</h1>
          <p className="text-gray-500 mt-1">{pagination.total} salariés au total</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingSalarie(null); setShowModal(true) }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un salarié</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par matricule, nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Matricule</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nom</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fonction</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Chantier</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ville</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Dernière visite</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : salaries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    Aucun salarié trouvé
                  </td>
                </tr>
              ) : (
                salaries.map((salarie) => (
                  <tr key={salarie.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{salarie.matricule}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {salarie.nom || salarie.prenom
                        ? `${salarie.nom || ''} ${salarie.prenom || ''}`.trim()
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      <div>{salarie.fonction || '-'}</div>
                      {salarie.typeFonction && (
                        <div className="text-xs text-gray-400">{salarie.typeFonction}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{salarie.chantier || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{salarie.ville || '-'}</td>
                    <td className="py-3 px-4">
                      {salarie.derniereVisite ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{format(new Date(salarie.derniereVisite.dateVisite), 'dd/MM/yyyy')}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Jamais</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(salarie)}
                          className="p-1 text-gray-600 hover:text-primary-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(salarie.id)}
                          className="p-1 text-gray-600 hover:text-red-600"
                        >
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {pagination.totalPages}
            </p>
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
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingSalarie ? 'Modifier le salarié' : 'Ajouter un salarié'}
                </h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Matricule *</label>
                  <input
                    type="text"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    className="input"
                    required
                    disabled={!!editingSalarie}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nom</label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Prénom</label>
                    <input
                      type="text"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Fonction</label>
                    <input
                      type="text"
                      value={formData.fonction}
                      onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Type fonction</label>
                    <input
                      type="text"
                      value={formData.typeFonction}
                      onChange={(e) => setFormData({ ...formData, typeFonction: e.target.value })}
                      className="input"
                      placeholder="QZ, MENS..."
                    />
                  </div>
                </div>

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
                    placeholder="CASA, RABAT..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingSalarie ? 'Mettre à jour' : 'Créer'}
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
