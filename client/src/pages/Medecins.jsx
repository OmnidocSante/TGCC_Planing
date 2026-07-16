import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  Stethoscope,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  Mail,
  X,
  Calendar,
  DollarSign
} from 'lucide-react'

const TYPE_TARIFS = [
  { value: 'PAR_VISITE', label: 'Par visite (forfait)', description: 'Montant fixe par déplacement au chantier' },
  { value: 'PAR_EXAMEN', label: 'Par examen', description: 'Montant par collaborateur examiné' },
  { value: 'MIXTE', label: 'Mixte', description: 'Forfait + montant par collaborateur' }
]

const VILLES = [
  'CASA', 'CASABLANCA', 'RABAT', 'KENITRA', 'MARRAKECH', 'FES', 'TANGER',
  'AGADIR', 'TETOUANE', 'NADOR', 'LARACHE', 'SAFI', 'BENGUERIR', 'JORF',
  'YOUSSOUFIA', 'BENI MELLAL', 'KHEMISSAT', 'ERRACHIDIA', 'HOUCEIMA', 'OUAZZANE'
]

export default function Medecins() {
  const [medecins, setMedecins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMedecin, setEditingMedecin] = useState(null)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    villes: [],
    telephone: '',
    email: '',
    typeTarif: 'PAR_VISITE',
    tarifVisite: '',
    tarifExamen: ''
  })

  useEffect(() => {
    fetchMedecins()
  }, [])

  const fetchMedecins = async () => {
    setLoading(true)
    try {
      const response = await api.get('/medecins')
      setMedecins(response.data.data)
    } catch (error) {
      console.error('Error fetching medecins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingMedecin) {
        await api.put(`/medecins/${editingMedecin.id}`, formData)
        toast.success('Médecin mis à jour')
      } else {
        await api.post('/medecins', formData)
        toast.success('Médecin créé')
      }
      setShowModal(false)
      setEditingMedecin(null)
      resetForm()
      fetchMedecins()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur')
    }
  }

  const handleEdit = (medecin) => {
    setEditingMedecin(medecin)
    setFormData({
      nom: medecin.nom,
      prenom: medecin.prenom || '',
      villes: medecin.villes || [],
      telephone: medecin.telephone || '',
      email: medecin.email || '',
      typeTarif: medecin.typeTarif || 'PAR_VISITE',
      tarifVisite: medecin.tarifVisite || '',
      tarifExamen: medecin.tarifExamen || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce médecin ?')) return
    try {
      await api.delete(`/medecins/${id}`)
      toast.success('Médecin supprimé')
      fetchMedecins()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const toggleVille = (ville) => {
    if (formData.villes.includes(ville)) {
      setFormData({ ...formData, villes: formData.villes.filter(v => v !== ville) })
    } else {
      setFormData({ ...formData, villes: [...formData.villes, ville] })
    }
  }

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      villes: [],
      telephone: '',
      email: '',
      typeTarif: 'PAR_VISITE',
      tarifVisite: '',
      tarifExamen: ''
    })
  }

  const formatMontant = (montant) => {
    if (!montant) return '-'
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(montant)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Médecins</h1>
          <p className="text-gray-500 mt-1">{medecins.length} médecins enregistrés</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingMedecin(null); setShowModal(true) }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un médecin</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : medecins.length === 0 ? (
        <div className="card text-center py-12">
          <Stethoscope className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun médecin</h3>
          <p className="text-gray-500 mb-6">Commencez par ajouter un médecin</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Ajouter un médecin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medecins.map((medecin) => (
            <div key={medecin.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-primary-100 rounded-full">
                    <Stethoscope className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Dr. {medecin.nom} {medecin.prenom || ''}
                    </h3>
                    <p className="text-sm text-gray-500">{medecin.visitesCount || 0} visites</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(medecin)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(medecin.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {medecin.villes && medecin.villes.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>Villes assignées</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medecin.villes.map((ville, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {ville}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm">
                {medecin.telephone && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{medecin.telephone}</span>
                  </div>
                )}
                {medecin.email && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{medecin.email}</span>
                  </div>
                )}
              </div>

              {/* Tarification */}
              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2 text-sm font-medium text-green-700 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span>Tarification</span>
                </div>
                <p className="text-xs text-green-600 mb-2">
                  {TYPE_TARIFS.find(t => t.value === medecin.typeTarif)?.label || 'Non défini'}
                </p>
                <div className="flex space-x-4 text-sm">
                  {(medecin.typeTarif === 'PAR_VISITE' || medecin.typeTarif === 'MIXTE') && (
                    <div>
                      <span className="text-gray-500">Forfait:</span>{' '}
                      <span className="font-semibold text-green-700">{formatMontant(medecin.tarifVisite)}</span>
                    </div>
                  )}
                  {(medecin.typeTarif === 'PAR_EXAMEN' || medecin.typeTarif === 'MIXTE') && (
                    <div>
                      <span className="text-gray-500">Par examen:</span>{' '}
                      <span className="font-semibold text-green-700">{formatMontant(medecin.tarifExamen)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`mt-4 pt-4 border-t flex items-center justify-between ${
                medecin.actif ? 'text-green-600' : 'text-gray-400'
              }`}>
                <span className="text-sm">
                  {medecin.actif ? '● Actif' : '○ Inactif'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingMedecin ? 'Modifier le médecin' : 'Ajouter un médecin'}
                </h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nom *</label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="input"
                      required
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

                <div>
                  <label className="label">Villes assignées</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {VILLES.map((ville) => (
                      <button
                        key={ville}
                        type="button"
                        onClick={() => toggleVille(ville)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          formData.villes.includes(ville)
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {ville}
                      </button>
                    ))}
                  </div>
                  {formData.villes.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {formData.villes.length} ville(s) sélectionnée(s)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="input"
                      placeholder="06 00 00 00 00"
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                      placeholder="docteur@email.com"
                    />
                  </div>
                </div>

                {/* Section Tarification */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span>Tarification</span>
                  </h3>
                  
                  <div className="mb-4">
                    <label className="label">Type de tarification</label>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPE_TARIFS.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, typeTarif: type.value })}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            formData.typeTarif === type.value
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-medium text-sm">{type.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {(formData.typeTarif === 'PAR_VISITE' || formData.typeTarif === 'MIXTE') && (
                      <div>
                        <label className="label">Tarif par visite (MAD)</label>
                        <input
                          type="number"
                          value={formData.tarifVisite}
                          onChange={(e) => setFormData({ ...formData, tarifVisite: e.target.value })}
                          className="input"
                          placeholder="Ex: 1500"
                          min="0"
                          step="100"
                        />
                      </div>
                    )}
                    {(formData.typeTarif === 'PAR_EXAMEN' || formData.typeTarif === 'MIXTE') && (
                      <div>
                        <label className="label">Tarif par examen (MAD)</label>
                        <input
                          type="number"
                          value={formData.tarifExamen}
                          onChange={(e) => setFormData({ ...formData, tarifExamen: e.target.value })}
                          className="input"
                          placeholder="Ex: 50"
                          min="0"
                          step="10"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingMedecin ? 'Mettre à jour' : 'Créer'}
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
