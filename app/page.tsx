'use client'

import { useState } from 'react'
import { Search, Download, Calendar, Globe, Building2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface CompanyData {
  companyName: string
  websiteUrl: string
  activeAds: number | null
  newAds: number | null
  found: boolean
  error?: string
}

interface AnalysisResults {
  companies: CompanyData[]
  dateRange: number
  analysisDate: string
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('')
  const [companies, setCompanies] = useState([
    { companyName: '', websiteUrl: '' },
    { companyName: '', websiteUrl: '' },
    { companyName: '', websiteUrl: '' }
  ])
  const [dateRange, setDateRange] = useState(7)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResults | null>(null)

  const handleCompanyChange = (index: number, field: 'companyName' | 'websiteUrl', value: string) => {
    const newCompanies = [...companies]
    newCompanies[index][field] = value
    setCompanies(newCompanies)
  }

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your OpenAI API key')
      return
    }

    const filledCompanies = companies.filter(c => c.companyName.trim() && c.websiteUrl.trim())
    if (filledCompanies.length === 0) {
      alert('Please fill at least one company name and website URL')
      return
    }

    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          companies: filledCompanies,
          dateRange
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Analysis failed:', error)
      alert('Analysis failed. Please check your API key and try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const exportToSpreadsheet = () => {
    if (!results) return

    const exportData = results.companies.map(company => ({
      'Company Name': company.companyName,
      'Website URL': company.websiteUrl,
      'Found in Ads Library': company.found ? 'Yes' : 'No',
      'Active Ads': company.found ? company.activeAds : 'N/A',
      'New Ads (Last ' + results.dateRange + ' Days)': company.found ? company.newAds : 'N/A',
      'Error': company.error || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facebook Ads Analysis')
    
    const fileName = `facebook-ads-analysis-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Facebook Ads Library Analyzer
          </h1>
          <p className="text-gray-600">
            Analyze active and new ads for multiple companies using AI
          </p>
        </div>

        {/* API Key Input */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI API Key
          </label>
          <input
            type="password"
            className="input-field"
            placeholder="Enter your OpenAI API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Company Inputs */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building2 className="mr-2" size={20} />
            Companies to Analyze
          </h3>
          {companies.map((company, index) => (
            <div key={index} className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-3">Company {index + 1}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter company name"
                    value={company.companyName}
                    onChange={(e) => handleCompanyChange(index, 'companyName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://example.com"
                    value={company.websiteUrl}
                    onChange={(e) => handleCompanyChange(index, 'websiteUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Calendar className="mr-2" size={16} />
            Date Range for New Ads
          </label>
          <select
            className="input-field max-w-xs"
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
          >
            <option value={1}>Last 1 day</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Analyze Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="btn-primary flex items-center mx-auto"
          >
            <Search className="mr-2" size={20} />
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="border-t pt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
              <button
                onClick={exportToSpreadsheet}
                className="btn-secondary flex items-center"
              >
                <Download className="mr-2" size={16} />
                Export to Excel
              </button>
            </div>
            
            <div className="text-sm text-gray-600 mb-6">
              Analysis Date: {results.analysisDate} | Date Range: Last {results.dateRange} days
            </div>

            <div className="grid gap-6">
              {results.companies.map((company, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Building2 className="mr-2" size={18} />
                        {company.companyName}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <Globe className="mr-1" size={14} />
                        {company.websiteUrl}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      company.found 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {company.found ? 'Found' : 'Not Found'}
                    </span>
                  </div>

                  {company.found ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-primary-600">
                          {company.activeAds}
                        </div>
                        <div className="text-sm text-gray-600">Active Ads</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {company.newAds}
                        </div>
                        <div className="text-sm text-gray-600">
                          New Ads (Last {results.dateRange} days)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-4 text-center text-gray-500">
                      {company.error || 'Company not found in Facebook Ads Library'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
