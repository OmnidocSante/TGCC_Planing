import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Building2,
  Stethoscope,
  Clock,
  CheckCircle,
  Eye,
  X,
  MapPin
} from 'lucide-react'

const COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500'
]

export default function PlanningCalendar() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState([])
  const [viewMode, setViewMode] = useState('month') // month, week
  const [stats, setStats] = useState({ totalVisites: 0, totalChantiers: 0, totalMedecins: 0 })

  useEffect(() => {
    fetchEvents()
  }, [currentMonth])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
      
      // Récupérer les visites planifiées
      const response = await api.get('/visites', {
        params: { dateDebut: start, dateFin: end, limit: 10000 }
      })
      
      const visites = response.data.data || []
      
      // Grouper par date et chantier
      const grouped = {}
      visites.forEach(v => {
        const dateKey = format(new Date(v.dateVisite), 'yyyy-MM-dd')
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            visites: [],
            chantiers: new Set(),
            medecins: new Set(),
            villes: new Set()
          }
        }
        grouped[dateKey].visites.push(v)
        if (v.chantier) grouped[dateKey].chantiers.add(v.chantier)
        if (v.medecin) grouped[dateKey].medecins.add(v.medecin.nom)
        if (v.ville) grouped[dateKey].villes.add(v.ville)
      })
      
      const eventsList = Object.values(grouped).map(g => ({
        ...g,
        chantiers: Array.from(g.chantiers),
        medecins: Array.from(g.medecins),
        villes: Array.from(g.villes),
        count: g.visites.length
      }))
      
      setEvents(eventsList)
      
      // Stats du mois
      const totalVisites = visites.length
      const totalChantiers = new Set(visites.map(v => v.chantier).filter(Boolean)).size
      const totalMedecins = new Set(visites.map(v => v.medecin?.id).filter(Boolean)).size
      setStats({ totalVisites, totalChantiers, totalMedecins })
      
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventsForDate = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return events.find(e => e.date === dateKey)
  }

  const handleDateClick = (date) => {
    const dayEvents = getEventsForDate(date)
    if (dayEvents && dayEvents.visites.length > 0) {
      setSelectedDate(date)
      setSelectedEvents(dayEvents.visites)
      setShowModal(true)
    }
  }

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="btn-secondary text-sm"
          >
            Aujourd'hui
          </button>
        </div>
      </div>
    )
  }

  const renderDays = () => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, idx) => (
          <div
            key={day}
            className={`text-center py-2 text-sm font-medium ${
              idx >= 5 ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    )
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day
        const dayEvents = getEventsForDate(day)
        const isCurrentMonth = isSameMonth(day, monthStart)
        const isSelected = selectedDate && isSameDay(day, selectedDate)
        const hasEvents = dayEvents && dayEvents.count > 0
        
        days.push(
          <div
            key={day.toString()}
            onClick={() => handleDateClick(cloneDay)}
            className={`
              min-h-[100px] p-2 border border-gray-100 transition-all
              ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
              ${isToday(day) ? 'ring-2 ring-primary-500 ring-inset' : ''}
              ${isSelected ? 'bg-primary-50' : ''}
              ${hasEvents ? 'cursor-pointer hover:bg-gray-50' : ''}
            `}
          >
            <div className={`
              text-sm font-medium mb-1
              ${isToday(day) ? 'text-primary-600' : ''}
            `}>
              {format(day, 'd')}
            </div>
            
            {hasEvents && isCurrentMonth && (
              <div className="space-y-1">
                {/* Indicateur nombre de visites */}
                <div className="flex items-center space-x-1 text-xs">
                  <Users className="w-3 h-3 text-blue-500" />
                  <span className="font-semibold text-blue-600">{dayEvents.count}</span>
                  <span className="text-gray-500">visites</span>
                </div>
                
                {/* Chantiers */}
                <div className="flex flex-wrap gap-1">
                  {dayEvents.chantiers.slice(0, 2).map((ch, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 text-[10px] text-white rounded ${COLORS[idx % COLORS.length]}`}
                    >
                      {ch.length > 12 ? ch.substring(0, 12) + '...' : ch}
                    </span>
                  ))}
                  {dayEvents.chantiers.length > 2 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded">
                      +{dayEvents.chantiers.length - 2}
                    </span>
                  )}
                </div>
                
                {/* Médecins */}
                {dayEvents.medecins.length > 0 && (
                  <div className="flex items-center space-x-1 text-[10px] text-gray-500">
                    <Stethoscope className="w-3 h-3" />
                    <span>{dayEvents.medecins.length} médecin(s)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      )
      days = []
    }
    
    return <div className="border border-gray-200 rounded-lg overflow-hidden">{rows}</div>
  }

  const renderStats = () => (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-200 rounded-lg">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalVisites}</p>
            <p className="text-xs text-blue-700">Visites ce mois</p>
          </div>
        </div>
      </div>
      <div className="card bg-gradient-to-br from-amber-50 to-amber-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-200 rounded-lg">
            <Building2 className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-900">{stats.totalChantiers}</p>
            <p className="text-xs text-amber-700">Chantiers</p>
          </div>
        </div>
      </div>
      <div className="card bg-gradient-to-br from-green-50 to-green-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-200 rounded-lg">
            <Stethoscope className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-900">{stats.totalMedecins}</p>
            <p className="text-xs text-green-700">Médecins</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier des visites</h1>
          <p className="text-gray-500 mt-1">Visualisez l'agenda des planifications</p>
        </div>
        <button
          onClick={() => navigate('/planning')}
          className="btn-secondary"
        >
          Retour aux plannings
        </button>
      </div>

      {renderStats()}

      <div className="card">
        {renderHeader()}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {renderDays()}
            {renderCells()}
          </>
        )}
      </div>

      {/* Légende */}
      <div className="card">
        <h3 className="font-medium text-gray-900 mb-3">Légende</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 ring-2 ring-primary-500 rounded"></div>
            <span>Aujourd'hui</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span>Nombre de visites</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Chantier</span>
          </div>
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-4 h-4 text-gray-500" />
            <span>Médecin assigné</span>
          </div>
        </div>
      </div>

      {/* Modal détails du jour */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen px-4 pt-20 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                  </h2>
                  <p className="text-gray-500">{selectedEvents.length} visite(s) programmée(s)</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Grouper par chantier */}
              {(() => {
                const byChantier = {}
                selectedEvents.forEach(v => {
                  const ch = v.chantier || 'Sans chantier'
                  if (!byChantier[ch]) {
                    byChantier[ch] = {
                      chantier: ch,
                      ville: v.ville,
                      medecin: v.medecin,
                      visites: []
                    }
                  }
                  byChantier[ch].visites.push(v)
                })
                
                return Object.values(byChantier).map((group, idx) => (
                  <div key={idx} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Building2 className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">{group.chantier}</p>
                          {group.ville && (
                            <p className="text-sm text-gray-500 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {group.ville}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                          {group.visites.length} visites
                        </span>
                        {group.medecin && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center justify-end">
                            <Stethoscope className="w-3 h-3 mr-1" />
                            Dr. {group.medecin.nom}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-500">Matricule</th>
                            <th className="text-left py-2 px-3 text-gray-500">Fonction</th>
                            <th className="text-left py-2 px-3 text-gray-500">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.visites.map((v, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="py-2 px-3 font-medium">{v.salarie?.matricule}</td>
                              <td className="py-2 px-3 text-gray-600">{v.salarie?.fonction || '-'}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  v.statut === 'EFFECTUEE' ? 'bg-green-100 text-green-700' :
                                  v.statut === 'PLANIFIEE' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {v.statut === 'EFFECTUEE' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                  {v.statut}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
