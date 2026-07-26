import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Bridal', 'Body', 'Makeup', 'General']

// Parse pasted text into name + phone pairs
function parseCustomers(text) {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean)
  const results = []
  const errors  = []

  lines.forEach((line, i) => {
    // Remove common WhatsApp artifacts
    let clean = line
      .replace(/^\d+\.\s*/,'')      // remove leading numbers like "1. "
      .replace(/^[-*]\s*/,'')       // remove bullet points
      .replace(/\s+/g, ' ')         // normalize spaces
      .trim()

    if (!clean) return

    // Try to extract phone number - look for 10+ digit sequences
    const phoneMatch = clean.match(/(\+?91)?[\s-]?([6-9]\d{9})/)

    if (!phoneMatch) {
      // Try to find any number sequence
      const anyNumber = clean.match(/\d{8,}/)
      if (!anyNumber) {
        errors.push({ line: i+1, text: line, reason: 'No phone number found' })
        return
      }
    }

    let phone = phoneMatch
      ? phoneMatch[2] || phoneMatch[0]
      : clean.match(/\d{8,}/)[0]

    // Clean phone
    phone = phone.replace(/\D/g,'')
    if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2)
    if (phone.length < 10) {
      errors.push({ line: i+1, text: line, reason: 'Phone number too short' })
      return
    }
    phone = phone.slice(-10)

    // Everything that's not the phone is the name
    let name = clean
      .replace(/\+?91[\s-]?/g,'')
      .replace(phone,'')
      .replace(/[-|,]/g,' ')
      .replace(/\s+/g,' ')
      .trim()

    if (!name || name.length < 2) name = 'Customer ' + phone.slice(-4)

    // Capitalize name
    name = name.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ')

    results.push({ name, phone })
  })

  return { results, errors }
}

export default function BulkImport() {
  const [activeTab, setActiveTab] = useState('customers')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Bulk Import</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Import customers and services in one go
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'customers'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>
          Import Customers
        </button>
        <button onClick={() => setActiveTab('services')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'services'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>
          Import Rate List
        </button>
      </div>

      {activeTab === 'customers' && <CustomerImport />}
      {activeTab === 'services'  && <ServiceImport />}
    </div>
  )
}

function CustomerImport() {
  const [text,      setText]      = useState('')
  const [parsed,    setParsed]    = useState(null)
  const [errors,    setErrors]    = useState([])
  const [importing, setImporting] = useState(false)
  const [results,   setResults]   = useState(null)
  const [step,      setStep]      = useState(1) // 1=paste, 2=preview, 3=done

  function handleParse() {
    if (!text.trim()) return alert('Please paste your customer list first')
    const { results, errors } = parseCustomers(text)
    setParsed(results)
    setErrors(errors)
    setStep(2)
  }

  function updateParsed(index, field, value) {
    setParsed(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removeParsed(index) {
    setParsed(prev => prev.filter((_, i) => i !== index))
  }

  async function importCustomers() {
    if (!parsed || parsed.length === 0) return
    setImporting(true)

    let imported = 0
    let skipped  = 0
    let failed   = 0

    for (const customer of parsed) {
      if (!customer.name || !customer.phone) { failed++; continue }

      // Check if phone already exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customer.phone)
        .single()

      if (existing) { skipped++; continue }

      const { error } = await supabase.from('customers').insert({
        name:  customer.name,
        phone: customer.phone,
      })

      if (error) { failed++ } else { imported++ }
    }

    setImporting(false)
    setResults({ imported, skipped, failed })
    setStep(3)
  }

  function reset() {
    setText('')
    setParsed(null)
    setErrors([])
    setResults(null)
    setStep(1)
  }

  return (
    <div>
      {/* Step 1 - Paste */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-700 mb-2">How to use</h3>
            <div className="text-xs text-blue-600 space-y-1">
              <p>1. Open your WhatsApp group member list or Excel/contacts sheet</p>
              <p>2. Copy all names and numbers</p>
              <p>3. Paste below - one customer per line</p>
              <p>4. The system will automatically detect names and phone numbers</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Supported formats - any of these work:</p>
            <div className="text-xs text-gray-400 font-mono space-y-1">
              <p>Noor Ahmed 9419123456</p>
              <p>Zara Malik - 7006123456</p>
              <p>+91 9858123456 Sana Wani</p>
              <p>1. Iqra Bashir | 9797123456</p>
              <p>Mehvish, 9419000123</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Paste your customer list here
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Noor Ahmed 9419123456\nZara Malik 7006654321\nSana Wani 9858112233\n...'}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-pink-300 h-64 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {text.split('\n').filter(l => l.trim()).length} lines pasted
            </p>
          </div>

          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40">
            Preview Import
          </button>
        </div>
      )}

      {/* Step 2 - Preview */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-semibold text-green-700">{parsed.length}</div>
              <div className="text-xs text-green-600">Ready to import</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-semibold text-amber-700">{errors.length}</div>
              <div className="text-xs text-amber-600">Could not parse</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-semibold text-gray-700">
                {parsed.length + errors.length}
              </div>
              <div className="text-xs text-gray-500">Total lines</div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                Could not parse {errors.length} lines - these will be skipped:
              </p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {errors.map((e, i) => (
                  <div key={i} className="text-xs text-amber-600">
                    Line {e.line}: "{e.text}" - {e.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview list - editable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Review and edit before importing
              </p>
              <button onClick={() => setStep(1)}
                className="text-xs text-pink-500 hover:text-pink-700">
                Back to paste
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">#</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Phone</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((c, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{i+1}</td>
                      <td className="px-3 py-2">
                        <input
                          value={c.name}
                          onChange={e => updateParsed(i, 'name', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-pink-300" />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={c.phone}
                          onChange={e => updateParsed(i, 'phone', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-pink-300" />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeParsed(i)}
                          className="text-xs text-red-400 hover:text-red-600">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              You can edit names and phone numbers before importing. Duplicate phones will be skipped automatically.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl text-sm hover:bg-gray-50">
              Start over
            </button>
            <button
              onClick={importCustomers}
              disabled={importing || parsed.length === 0}
              className="flex-1 bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40">
              {importing
                ? 'Importing...'
                : 'Import ' + parsed.length + ' Customers'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - Done */}
      {step === 3 && results && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">OK</div>
            <h3 className="text-lg font-bold text-green-700 mb-4">Import Complete!</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3">
                <div className="text-2xl font-bold text-green-600">{results.imported}</div>
                <div className="text-xs text-gray-500">Imported</div>
              </div>
              <div className="bg-white rounded-xl p-3">
                <div className="text-2xl font-bold text-amber-500">{results.skipped}</div>
                <div className="text-xs text-gray-500">Already existed</div>
              </div>
              <div className="bg-white rounded-xl p-3">
                <div className="text-2xl font-bold text-red-400">{results.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Existing customers with the same phone number were skipped to avoid duplicates.
          </p>
          <button onClick={reset}
            className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700">
            Import More Customers
          </button>
        </div>
      )}
    </div>
  )
}

function ServiceImport() {
  const emptyRow = { name:'', category:'Hair', duration_mins:60, price:'', description:'' }
  const [rows,    setRows]    = useState([{ ...emptyRow }])
  const [saving,  setSaving]  = useState(false)
  const [results, setResults] = useState(null)

  function addRow() {
    setRows(prev => [...prev, { ...emptyRow }])
  }

  function updateRow(index, field, value) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function removeRow(index) {
    if (rows.length === 1) return
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  function duplicateRow(index) {
    const row = { ...rows[index] }
    setRows(prev => [...prev.slice(0, index+1), row, ...prev.slice(index+1)])
  }

  async function importServices() {
    const valid = rows.filter(r => r.name.trim() && r.price)
    if (valid.length === 0) return alert('Add at least one service with name and price')
    setSaving(true)

    let imported = 0
    let failed   = 0

    for (const row of valid) {
      const { error } = await supabase.from('services').insert({
        name:          row.name.trim(),
        category:      row.category,
        duration_mins: Number(row.duration_mins) || 60,
        price:         Number(row.price),
        description:   row.description.trim() || null,
        is_active:     true,
      })
      if (error) { failed++ } else { imported++ }
    }

    setSaving(false)
    setResults({ imported, failed, total: valid.length })
  }

  function reset() {
    setRows([{ ...emptyRow }])
    setResults(null)
  }

  if (results) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">OK</div>
          <h3 className="text-lg font-bold text-green-700 mb-4">Rate List Imported!</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3">
              <div className="text-2xl font-bold text-green-600">{results.imported}</div>
              <div className="text-xs text-gray-500">Services added</div>
            </div>
            <div className="bg-white rounded-xl p-3">
              <div className="text-2xl font-bold text-red-400">{results.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          All imported services are now active and available for booking.
        </p>
        <button onClick={reset}
          className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700">
          Import More Services
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-700 mb-2">How to use</h3>
        <div className="text-xs text-blue-600 space-y-1">
          <p>1. Look at your rate list PDF</p>
          <p>2. Enter each service below - name, category, duration and price</p>
          <p>3. Click Duplicate to quickly copy a similar service</p>
          <p>4. Click Import All when done</p>
        </div>
      </div>

      {/* Service rows */}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500">
                Service {i+1}
              </span>
              <div className="flex gap-2">
                <button onClick={() => duplicateRow(i)}
                  className="text-xs text-blue-400 hover:text-blue-600">
                  Duplicate
                </button>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)}
                    className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="col-span-2">
                <input
                  value={row.name}
                  onChange={e => updateRow(i, 'name', e.target.value)}
                  placeholder="Service name *"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <select
                  value={row.category}
                  onChange={e => updateRow(i, 'category', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  value={row.price}
                  onChange={e => updateRow(i, 'price', e.target.value)}
                  placeholder="Price (Rs.) *"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <input
                  type="number"
                  value={row.duration_mins}
                  onChange={e => updateRow(i, 'duration_mins', e.target.value)}
                  placeholder="Duration (mins)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
              <div>
                <input
                  value={row.description}
                  onChange={e => updateRow(i, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-300" />
              </div>
            </div>

            {row.name && row.price && (
              <div className="bg-pink-50 rounded-lg px-3 py-1.5 text-xs text-pink-600">
                {row.name} - {row.category} - {row.duration_mins} min - Rs.{Number(row.price).toLocaleString('en-IN')}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full border-2 border-dashed border-gray-200 text-gray-400 py-3 rounded-xl text-sm hover:border-pink-300 hover:text-pink-400 transition-colors">
        + Add another service
      </button>

      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
        <span className="font-medium">{rows.filter(r => r.name && r.price).length}</span> services ready to import
        {rows.filter(r => !r.name || !r.price).length > 0 && (
          <span className="text-amber-500">
            {' '}({rows.filter(r => !r.name || !r.price).length} incomplete - will be skipped)
          </span>
        )}
      </div>

      <button
        onClick={importServices}
        disabled={saving || rows.filter(r => r.name && r.price).length === 0}
        className="w-full bg-pink-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-40">
        {saving
          ? 'Importing...'
          : 'Import ' + rows.filter(r => r.name && r.price).length + ' Services'}
      </button>
    </div>
  )
}