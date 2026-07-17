import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  FileUp,
  Upload,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  Clock,
  TrendingUp,
  Download,
  XCircle,
  AlertTriangle
} from 'lucide-react'

export default function Import() {
  const [activeTab, setActiveTab] = useState('historique')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const downloadTemplate = async (type) => {
    try {
      const response = await api.get(`/import/template/${type}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `template_${type === 'historique' ? 'historique_visites' : 'fichier_client'}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Template téléchargé')
    } catch (error) {
      toast.error('Erreur lors du téléchargement du template')
    }
  }

  // Simuler la progression pendant l'upload
  useEffect(() => {
    let interval
    if (uploading) {
      setProgress(0)
      setProgressText('Lecture du fichier...')
      
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) {
            setProgressText('Lecture du fichier Excel...')
            return prev + 5
          } else if (prev < 60) {
            setProgressText('Analyse des données...')
            return prev + 3
          } else if (prev < 85) {
            setProgressText('Comparaison avec la base de données...')
            return prev + 2
          } else if (prev < 95) {
            setProgressText('Calcul des résultats...')
            return prev + 1
          }
          return prev
        })
      }, 200)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [uploading])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validation du fichier
    const validExtensions = ['.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!validExtensions.includes(fileExtension)) {
      setImportError({
        title: 'Format de fichier invalide',
        message: `Le fichier "${file.name}" n'est pas un fichier Excel valide.`,
        details: ['Formats acceptés: .xlsx, .xls', 'Veuillez télécharger le template si nécessaire.']
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setImportError({
        title: 'Fichier trop volumineux',
        message: `Le fichier "${file.name}" dépasse la taille maximale autorisée.`,
        details: ['Taille maximale: 50 MB', `Taille du fichier: ${(file.size / 1024 / 1024).toFixed(2)} MB`]
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    setResult(null)
    setImportError(null)
    setProgress(0)

    try {
      const endpoint = activeTab === 'historique' ? '/import/historique' : '/import/client'
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const uploadPercent = Math.round((progressEvent.loaded * 20) / progressEvent.total)
          setProgress(uploadPercent)
        }
      })

      setProgress(100)
      setProgressText('Terminé !')
      setResult(response.data)
      toast.success(response.data.message)
    } catch (error) {
      const errorResponse = error.response?.data
      
      let errorDetails = []
      if (errorResponse?.errors) {
        errorDetails = errorResponse.errors.map(e => e.message || e)
      }
      
      setImportError({
        title: 'Erreur lors de l\'import',
        message: errorResponse?.message || 'Une erreur est survenue lors de l\'importation du fichier.',
        details: errorDetails.length > 0 ? errorDetails : [
          'Vérifiez que le fichier contient les colonnes requises.',
          'Assurez-vous que le format des données est correct.',
          'Téléchargez le template pour voir un exemple du format attendu.'
        ]
      })
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 500)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleGeneratePlanning = () => {
    if (result?.data?.aPlanifier?.length > 0) {
      const salarieIds = result.data.aPlanifier.map(s => s.salarieId)
      navigate('/planning', { state: { salarieIds, fromImport: true } })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import de fichiers</h1>
        <p className="text-gray-500 mt-1">Importez l'historique des visites ou le fichier client</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('historique'); setResult(null); setImportError(null) }}
          className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
            activeTab === 'historique'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Historique des visites</span>
          </div>
        </button>
        <button
          onClick={() => { setActiveTab('client'); setResult(null); setImportError(null) }}
          className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
            activeTab === 'client'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Fichier client (comparaison)</span>
          </div>
        </button>
      </div>

      {/* Upload zone */}
      <div className="card">
        <div className="text-center">
          {activeTab === 'historique' ? (
            <>
              <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Import de l'historique des visites
              </h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Importez votre fichier Excel contenant l'historique des visites médicales.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-lg mx-auto">
                <h4 className="font-medium text-blue-800 mb-2">Colonnes attendues:</h4>
                <ul className="text-sm text-blue-700 text-left list-disc list-inside space-y-1">
                  <li><strong>Matricule</strong> - Numéro matricule du salarié (obligatoire)</li>
                  <li><strong>Médecin</strong> - Nom du médecin</li>
                  <li><strong>Date Visite</strong> - Date de la visite (JJ/MM/AAAA ou JJ-mois)</li>
                  <li><strong>Chantier</strong> - Nom du chantier</li>
                  <li><strong>Ville</strong> - Ville du chantier</li>
                </ul>
              </div>
              <button
                onClick={() => downloadTemplate('historique')}
                className="btn-secondary flex items-center space-x-2 mx-auto mb-6"
              >
                <Download className="w-5 h-5" />
                <span>Télécharger le template avec exemple</span>
              </button>
            </>
          ) : (
            <>
              <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Import du fichier client
              </h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Importez la liste des salariés pour vérifier ceux qui ont besoin d'une visite médicale.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-lg mx-auto">
                <h4 className="font-medium text-green-800 mb-2">Colonnes attendues:</h4>
                <ul className="text-sm text-green-700 text-left list-disc list-inside space-y-1">
                  <li><strong>Matricule</strong> - Numéro matricule du salarié (obligatoire)</li>
                  <li><strong>Fonction</strong> - Fonction/Poste du salarié</li>
                  <li><strong>Type Fonction</strong> - Catégorie de fonction</li>
                  <li><strong>Chantier</strong> - Chantier actuel</li>
                </ul>
                <p className="text-xs text-green-600 mt-3 italic">
                  Le système compare la date de dernière visite avec la règle des 12 mois.
                </p>
              </div>
              <button
                onClick={() => downloadTemplate('client')}
                className="btn-secondary flex items-center space-x-2 mx-auto mb-6"
              >
                <Download className="w-5 h-5" />
                <span>Télécharger le template avec exemple</span>
              </button>
            </>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="mb-6 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary-600">{progressText}</span>
                <span className="text-sm font-medium text-primary-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-center mt-3 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Traitement en cours, veuillez patienter...
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          
          {!uploading && (
            <label
              htmlFor="file-upload"
              className="inline-flex items-center space-x-2 btn-primary cursor-pointer"
            >
              <Upload className="w-5 h-5" />
              <span>Sélectionner un fichier Excel</span>
            </label>
          )}

          <p className="text-sm text-gray-400 mt-3">
            Formats acceptés: .xlsx, .xls (max 50 MB)
          </p>
        </div>
      </div>

      {/* Import Error */}
      {importError && (
        <div className="card bg-red-50 border-red-300">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-red-100 rounded-full">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 text-lg">{importError.title}</h3>
              <p className="text-red-700 mt-1">{importError.message}</p>
              {importError.details && importError.details.length > 0 && (
                <div className="mt-3 bg-red-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 mb-2">Détails:</p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                    {importError.details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => setImportError(null)}
                  className="btn-secondary text-sm"
                >
                  Fermer
                </button>
                <button
                  onClick={() => downloadTemplate(activeTab)}
                  className="btn-primary text-sm flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le template</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card bg-green-50 border-green-200">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-green-900">{result.message}</h3>
                {activeTab === 'client' && result.data?.summary && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-gray-400" />
                        <p className="text-sm text-gray-500">Total analysés</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{result.data.summary.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <p className="text-sm text-gray-500">À planifier</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-600 mt-1">{result.data.summary.aPlanifier}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <p className="text-sm text-gray-500">À jour</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600 mt-1">{result.data.summary.aJour}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <p className="text-sm text-gray-500">Nouveaux</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 mt-1">{result.data.summary.nouveaux}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Employees to plan */}
          {activeTab === 'client' && result.data?.aPlanifier?.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Salariés à planifier ({result.data.aPlanifier.length})
                </h3>
                <button
                  onClick={handleGeneratePlanning}
                  className="btn-primary flex items-center space-x-2"
                >
                  <span>Générer le planning</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Matricule</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fonction</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Chantier</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Dernière visite</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Jours écoulés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.aPlanifier.slice(0, 50).map((salarie, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{salarie.matricule}</td>
                        <td className="py-3 px-4 text-gray-600">{salarie.fonction || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{salarie.typeFonction || '-'}</td>
                        <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{salarie.chantier || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">
                          {salarie.derniereVisite 
                            ? new Date(salarie.derniereVisite).toLocaleDateString('fr-FR')
                            : <span className="text-orange-600 font-medium">Jamais</span>}
                        </td>
                        <td className="py-3 px-4">
                          {salarie.joursDepuisDerniereVisite !== null ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              salarie.joursDepuisDerniereVisite > 365
                                ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {salarie.joursDepuisDerniereVisite} jours
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Nouveau
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.data.aPlanifier.length > 50 && (
                  <p className="text-center text-gray-500 py-4 bg-gray-50">
                    Et {result.data.aPlanifier.length - 50} autres salariés...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Employees up to date */}
          {activeTab === 'client' && result.data?.aJour?.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Salariés à jour ({result.data.summary.aJour})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Matricule</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fonction</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Dernière visite</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Prochaine visite</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Jours restants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.aJour.slice(0, 20).map((salarie, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{salarie.matricule}</td>
                        <td className="py-3 px-4 text-gray-600">{salarie.fonction || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(salarie.derniereVisite).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(salarie.prochaineVisite).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            salarie.joursRestants < 30
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {salarie.joursRestants} jours
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {result.data?.errors?.length > 0 && (
            <div className="card bg-red-50 border-red-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-900">Erreurs rencontrées</h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {result.data.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
