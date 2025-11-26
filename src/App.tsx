import { useState } from 'react'
import './App.css'

type Step = 'idle' | 'creating-assistant' | 'purchasing-number' | 'associating' | 'complete' | 'error'

interface AgentResult {
  assistantId: string
  phoneNumberId: string
  phoneNumber: string
  agentName: string
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [agentName, setAgentName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AgentResult | null>(null)

  const generateSystemPrompt = (description: string): string => {
    return `You are an AI assistant created with the following purpose and behavior:

${description}

Guidelines:
- Be helpful, professional, and conversational
- Stay focused on your defined purpose
- If asked about topics outside your scope, politely redirect the conversation
- Be concise but thorough in your responses
- Maintain a friendly and approachable tone`
  }

  const createAssistant = async (): Promise<string> => {
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentName || 'VAPI Agent',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: generateSystemPrompt(prompt),
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'sarah',
        },
        firstMessage: `Hello! I'm ${agentName || 'your AI assistant'}. How can I help you today?`,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to create assistant: ${response.status}`)
    }

    const data = await response.json()
    return data.id
  }

  const purchasePhoneNumber = async (): Promise<{ id: string; number: string }> => {
    // First, search for available numbers
    const searchResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaCode: '415',
        name: agentName || 'VAPI Agent Number',
      }),
    })

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to purchase phone number: ${searchResponse.status}`)
    }

    const data = await searchResponse.json()
    return { id: data.id, number: data.number }
  }

  const associatePhoneNumber = async (phoneNumberId: string, assistantId: string): Promise<void> => {
    const response = await fetch(`https://api.vapi.ai/phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: assistantId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to associate phone number: ${response.status}`)
    }
  }

  const downloadVCard = (name: string, phoneNumber: string) => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;TYPE=CELL:${phoneNumber}
NOTE:Created with VAPI Agent Creator
END:VCARD`

    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name.replace(/\s+/g, '_')}.vcf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!prompt.trim() || !apiKey.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setError(null)
    setResult(null)

    try {
      // Step 1: Create assistant
      setStep('creating-assistant')
      const assistantId = await createAssistant()

      // Step 2: Purchase phone number
      setStep('purchasing-number')
      const { id: phoneNumberId, number: phoneNumber } = await purchasePhoneNumber()

      // Step 3: Associate phone number with assistant
      setStep('associating')
      await associatePhoneNumber(phoneNumberId, assistantId)

      // Success!
      setStep('complete')
      setResult({
        assistantId,
        phoneNumberId,
        phoneNumber,
        agentName: agentName || 'VAPI Agent',
      })
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    }
  }

  const getStepStatus = (targetStep: Step) => {
    const stepOrder: Step[] = ['creating-assistant', 'purchasing-number', 'associating', 'complete']
    const currentIndex = stepOrder.indexOf(step)
    const targetIndex = stepOrder.indexOf(targetStep)

    if (currentIndex === -1) return 'pending'
    if (targetIndex < currentIndex) return 'completed'
    if (targetIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="container">
      <h1 className="title">VAPI Agent Creator</h1>
      <p className="subtitle">Create your AI phone agent in seconds</p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="apiKey">
              VAPI API Key *
            </label>
            <input
              type="password"
              id="apiKey"
              className="input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your VAPI API key"
              disabled={step !== 'idle' && step !== 'error'}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="agentName">
              Agent Name
            </label>
            <input
              type="text"
              id="agentName"
              className="input"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="My AI Assistant"
              disabled={step !== 'idle' && step !== 'error'}
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="prompt">
              Agent Description *
            </label>
            <textarea
              id="prompt"
              className="textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what your agent should do and how it should behave. For example: 'A friendly customer support agent for a coffee shop that can answer questions about menu items, hours of operation, and take reservations.'"
              disabled={step !== 'idle' && step !== 'error'}
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={step !== 'idle' && step !== 'error'}
          >
            {step === 'idle' || step === 'error' ? (
              'Create Agent'
            ) : (
              <span className="button-loading">
                <span className="spinner"></span>
                Creating...
              </span>
            )}
          </button>
        </form>

        {(step !== 'idle' && step !== 'error') && (
          <div className="progress-steps animate-in">
            <div className={`step ${getStepStatus('creating-assistant')}`}>
              <span className="step-indicator">
                {getStepStatus('creating-assistant') === 'completed' ? '✓' : '1'}
              </span>
              Creating AI Assistant
            </div>
            <div className={`step ${getStepStatus('purchasing-number')}`}>
              <span className="step-indicator">
                {getStepStatus('purchasing-number') === 'completed' ? '✓' : '2'}
              </span>
              Purchasing Phone Number
            </div>
            <div className={`step ${getStepStatus('associating')}`}>
              <span className="step-indicator">
                {getStepStatus('associating') === 'completed' ? '✓' : '3'}
              </span>
              Connecting Agent to Number
            </div>
          </div>
        )}

        {error && (
          <div className="status status-error animate-in">
            <span className="status-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="success-card animate-in">
            <h3>Agent Created Successfully!</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Your agent "{result.agentName}" is ready to receive calls
            </p>
            <div className="phone-number">{result.phoneNumber}</div>
            <button
              className="add-contact-button"
              onClick={() => downloadVCard(result.agentName, result.phoneNumber)}
            >
              Add to Contacts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
