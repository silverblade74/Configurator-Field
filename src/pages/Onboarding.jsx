import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import {
  updateBrandingSettings,
  createMinistry,
  createEvent,
  completeOnboarding,
} from '../services/firestore'
import { Timestamp } from 'firebase/firestore'
import { Church, Users, Calendar, ArrowRight, ArrowLeft, Check } from 'lucide-react'

const STEPS = [
  { title: 'Welcome', subtitle: "What's your church name?", icon: Church },
  { title: 'First Ministry', subtitle: 'Create your first ministry', icon: Users },
  { title: 'First Event', subtitle: 'Create your first event', icon: Calendar },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [churchName, setChurchName] = useState('')
  const [ministryName, setMinistryName] = useState('')
  const [ministryDesc, setMinistryDesc] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')

  function canNext() {
    if (step === 0) return churchName.trim().length > 0
    if (step === 1) return ministryName.trim().length > 0
    if (step === 2) return eventTitle.trim().length > 0 && eventDate.length > 0
    return false
  }

  async function handleComplete() {
    if (!canNext()) return
    setSaving(true)
    try {
      // Save branding
      await updateBrandingSettings({
        churchName: churchName.trim(),
        primaryColor: '#2563eb',
        logoUrl: '',
      })

      // Create ministry
      await createMinistry({
        name: ministryName.trim(),
        description: ministryDesc.trim(),
      })

      // Create event
      await createEvent({
        title: eventTitle.trim(),
        description: '',
        date: Timestamp.fromDate(new Date(eventDate)),
        location: '',
        ministryId: '',
        maxVolunteers: null,
        durationHours: null,
      })

      // Mark onboarding complete
      await completeOnboarding()

      toast.success('Setup complete! Welcome to ' + churchName.trim())
      navigate('/admin')
    } catch (err) {
      console.error('Onboarding error:', err)
      toast.error('Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  const StepIcon = STEPS[step].icon

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center justify-center space-x-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    i < step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
              <StepIcon size={24} className="text-primary-600" />
            </div>
            <h1 className="text-xl font-bold">{STEPS[step].title}</h1>
            <p className="text-sm text-gray-500 mt-1">{STEPS[step].subtitle}</p>
          </div>

          {/* Step 1: Church Name */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Church Name</label>
                <input
                  type="text"
                  className="input text-center text-lg"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="e.g. Grace Community Church"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: First Ministry */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Ministry Name</label>
                <input
                  type="text"
                  className="input"
                  value={ministryName}
                  onChange={(e) => setMinistryName(e.target.value)}
                  placeholder="e.g. Worship Team"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={ministryDesc}
                  onChange={(e) => setMinistryDesc(e.target.value)}
                  placeholder="What does this ministry do?"
                />
              </div>
            </div>
          )}

          {/* Step 3: First Event */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="label">Event Title</label>
                <input
                  type="text"
                  className="input"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Sunday Service"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn-secondary flex items-center space-x-1"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="btn-primary flex items-center space-x-1"
              >
                <span>Next</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={!canNext() || saving}
                className="btn-primary flex items-center space-x-1"
              >
                <Check size={16} />
                <span>{saving ? 'Setting up...' : 'Complete Setup'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Skip link */}
        <p className="text-center mt-4">
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Skip setup for now
          </button>
        </p>
      </div>
    </div>
  )
}
