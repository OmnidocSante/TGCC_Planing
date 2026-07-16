import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  DollarSign,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  Building2,
  TrendingUp
} from 'lucide-react'

const STATUTS = [
  { value: 'EN_ATTENTE', label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  { value: 'VALIDE', label: 'Validé', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  { value: 'PAYE', label: 'Payé', color: 'bg-green-100 text-green-700', icon: CreditCard },
  { value: 'ANNULE', label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle }
]

const TYPE_TARIFS = {
  PAR_VISITE: 'Par visite (forfait)',
  PAR_EXAMEN: 'Par examen',
  MIXTE: 'Mixte (forfait + variable)'
}

export default function Honoraires() {
  const [honoraires, setHonoraires] = useState([])
  const [loading, setLoading] = useState(true)
  const [medecins, setMedecins] = useState([])
  const [stats, setStats] = useState([])
  const [totaux, setTotaux] = useState({ montantTotal: 0, nbExamens: 0, nbHonoraires: 0 })
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filters, setFilters] = useState({ medecinId: '', statut: '', dateDebut: '', dateFin: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkData, setBulkData] = useState({ statut: 'PAYE', datePaiement: format(new Date(), 'yyyy-MM-dd'), reference: '' })
  const [activeTab, setActiveTab] = useState('liste')

  useEffect(() => {
    fetchHonoraires()
    fetchMedecins()
    fetchStats()
  }, [pagination.page, filters])

  const fetchHonoraires = async () => {
    setLoading(true)
    try {
      const params = { page: pagination.page, limit: 20 }
      if (filters.medecinId) params.medecinId = filters.medecinId
      if (filters.statut) params.statut = filters.statut
      if (filters.dateDebut) params.dateDebut = filters.dateDebut
      if (filters.dateFin) params.dateFin = filters.dateFin

      const response = await api.get('/honoraires', { params })
      setHonoraires(response.data.data)
      setTotaux(response.data.totaux)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching honoraires:', error)
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

  const fetchStats = async () => {
    try {
      const params = {}
      if (filters.dateDebut) params.dateDebut = filters.dateDebut
      if (filters.dateFin) params.dateFin = filters.dateFin
      
      const response = await api.get('/honoraires/stats', { params })
      setStats(response.data.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleStatutChange = async (id, newStatut) => {
    try {
      await api.put(`/honoraires/${id}/statut`, { statut: newStatut })
      toast.success('Statut mis à jour')
      fetchHonoraires()
      fetchStats()
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Sélectionnez au moins un honoraire')
      return
    }

    try {
      await api.put('/honoraires/bulk-statut', {
        ids: selectedIds,
        ...bulkData
      })
      toast.success(`${selectedIds.length} honoraires mis à jour`)
      setSelectedIds([])
      setShowBulkModal(false)
      fetchHonoraires()
      fetchStats()
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === honoraires.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(honoraires.map(h => h.id))
    }
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

  const formatMontant = (montant) => {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(montant || 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Honoraires Médecins</h1>
          <p className="text-gray-500 mt-1">Gestion des paiements et facturation</p>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <CreditCard className="w-5 h-5" />
            <span>Payer {selectedIds.length} sélectionnés</span>
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('liste')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'liste'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Liste des honoraires
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Statistiques par médecin
          </button>
        </nav>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-200 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-900">{formatMontant(totaux.montantTotal)}</p>
              <p className="text-xs text-green-700">Montant total</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-200 rounded-lg">
              <Users className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-900">{totaux.nbExamens}</p>
              <p className="text-xs text-blue-700">Examens effectués</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-200 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-purple-900">{totaux.nbHonoraires}</p>
              <p className="text-xs text-purple-700">Honoraires</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-200 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-900">
                {totaux.nbExamens > 0 ? formatMontant(totaux.montantTotal / totaux.nbExamens) : '0 MAD'}
              </p>
              <p className="text-xs text-amber-700">Coût moyen/examen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-700">Filtres</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Médecin</label>
            <select
              value={filters.medecinId}
              onChange={(e) => setFilters({ ...filters, medecinId: e.target.value })}
              className="input"
            >
              <option value="">Tous les médecins</option>
              {medecins.map(m => (
                <option key={m.id} value={m.id}>Dr. {m.nom} {m.prenom || ''}</option>
              ))}
            </select>
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
              onClick={() => setFilters({ medecinId: '', statut: '', dateDebut: '', dateFin: '' })}
              className="btn-secondary w-full"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'liste' ? (
        /* Table des honoraires */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === honoraires.length && honoraires.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Médecin</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Chantier</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Examens</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">Chargement...</td>
                  </tr>
                ) : honoraires.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">Aucun honoraire trouvé</td>
                  </tr>
                ) : (
                  honoraires.map((h) => (
                    <tr key={h.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedIds.includes(h.id) ? 'bg-primary-50' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(h.id)}
                          onChange={() => toggleSelect(h.id)}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {format(new Date(h.dateVisite), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          Dr. {h.medecin.nom} {h.medecin.prenom || ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{h.chantier || '-'}</div>
                        <div className="text-xs text-gray-500">{h.ville || ''}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {TYPE_TARIFS[h.typeTarif] || h.typeTarif}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{h.nbExamens}</td>
                      <td className="py-3 px-4 text-right font-bold text-green-600">
                        {formatMontant(h.montantTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={h.statut}
                          onChange={(e) => handleStatutChange(h.id, e.target.value)}
                          className={`text-xs rounded-full px-2 py-1 border-0 ${
                            STATUTS.find(s => s.value === h.statut)?.color || ''
                          }`}
                        >
                          {STATUTS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
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
      ) : (
        /* Stats par médecin */
        <div className="grid gap-4">
          {stats.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">
              Aucune donnée disponible
            </div>
          ) : (
            stats.map((s) => (
              <div key={s.medecin?.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-bold text-lg">
                        {s.medecin?.nom?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Dr. {s.medecin?.nom} {s.medecin?.prenom || ''}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {TYPE_TARIFS[s.medecin?.typeTarif] || 'Non défini'}
                        {s.medecin?.tarifVisite && ` • Forfait: ${formatMontant(s.medecin.tarifVisite)}`}
                        {s.medecin?.tarifExamen && ` • Par examen: ${formatMontant(s.medecin.tarifExamen)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{formatMontant(s.totalMontant)}</p>
                    <p className="text-sm text-gray-500">{s.totalVisites} visites • {s.totalExamens} examens</p>
                  </div>
                </div>
                
                {/* Détails par statut */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {STATUTS.map(statut => {
                    const data = s.parStatut[statut.value]
                    return (
                      <div key={statut.value} className={`p-2 rounded-lg ${statut.color.replace('text-', 'bg-').split(' ')[0]}`}>
                        <p className="text-xs font-medium">{statut.label}</p>
                        <p className="text-lg font-bold">{formatMontant(data?.montant || 0)}</p>
                        <p className="text-xs">{data?.count || 0} honoraires</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal paiement en masse */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowBulkModal(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Paiement de {selectedIds.length} honoraires
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Nouveau statut</label>
                  <select
                    value={bulkData.statut}
                    onChange={(e) => setBulkData({ ...bulkData, statut: e.target.value })}
                    className="input"
                  >
                    {STATUTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {bulkData.statut === 'PAYE' && (
                  <>
                    <div>
                      <label className="label">Date de paiement</label>
                      <input
                        type="date"
                        value={bulkData.datePaiement}
                        onChange={(e) => setBulkData({ ...bulkData, datePaiement: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Référence de paiement</label>
                      <input
                        type="text"
                        value={bulkData.reference}
                        onChange={(e) => setBulkData({ ...bulkData, reference: e.target.value })}
                        className="input"
                        placeholder="Ex: VIR-2026-001"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => setShowBulkModal(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button onClick={handleBulkUpdate} className="btn-primary">
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
