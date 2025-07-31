'use client';

import { useState } from 'react';
import { Search, Download, Calendar, Building, Globe, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function AdsAnalyzer() {
  const [formData, setFormData] = useState({
    apiKey: '',
    companies: [
      { name: '', url: '' },
      { name: '', url: '' },
      { name: '', url: '' }
    ],
    dateRange: 7
  });
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dateRangeOptions = [
    { value: 1, label: '1 Day' },
    { value: 3, label: '3 Days' },
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' }
  ];

  const handleCompanyChange = (index, field, value) => {
    const newCompanies = [...formData.companies];
    newCompanies[index][field] = value;
    setFormData({ ...formData, companies: newCompanies });
  };

  const handleAnalyze = async () => {
    if (!formData.apiKey) {
      setError('Please enter your OpenAI API key');
      return;
    }

    const filledCompanies = formData.companies.filter(comp => comp.url);
    if (filledCompanies.length === 0) {
      setError('Please enter at least one website URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: formData.apiKey,
          companies: filledCompanies,
          dateRange: formData.dateRange
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze ads');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing ads');
    } finally {
      setLoading(false);
    }
  };

  const exportToSpreadsheet = () => {
    if (!results) return;

    const csvData = [
      ['Company Name', 'Website URL', 'Verified', 'Platform', 'Found', 'Active Ads', `New Ads (Last ${results.dateRange} days)`, 'Analyzed At']
    ];
    
    results.companies.forEach(company => {
      Object.entries(company.platforms).forEach(([platform, data]) => {
        csvData.push([
          company.companyName || 'N/A',
          company.websiteUrl,
          company.verified ? 'Yes' : 'No',
          platform.charAt(0).toUpperCase() + platform.slice(1),
          data.found ? 'Yes' : 'No',
          data.found ? data.activeAds : 0,
          data.found ? data.newAds : 0,
          new Date(results.analyzedAt).toLocaleString()
        ]);
      });
    });

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi_platform_ads_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Multi-Platform Ads Library Analyzer</h1>
          <p className="text-gray-600">Analyze competitor ad activity across Facebook, Instagram, Bing & TikTok</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Building className="mr-2 text-blue-600" />
            Configuration
          </h2>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* API Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
          </div>

          {/* Companies */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">Companies to Analyze</h3>
            {formData.companies.map((company, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company {index + 1} Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nike, Apple, Tesla"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={company.name}
                    onChange={(e) => handleCompanyChange(index, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      placeholder="https://example.com"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={company.url}
                      onChange={(e) => handleCompanyChange(index, 'url', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Date Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              Date Range for New Ads
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.dateRange}
              onChange={(e) => setFormData({ ...formData, dateRange: parseInt(e.target.value) })}
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader className="animate-spin mr-2 h-5 w-5" />
                Analyzing Ads Across All Platforms...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Analyze All Platforms
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold flex items-center">
                <CheckCircle className="mr-2 text-green-600" />
                Multi-Platform Analysis Results
              </h2>
              <button
                onClick={exportToSpreadsheet}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Analysis Date:</strong> {new Date(results.analyzedAt).toLocaleString()} | 
                <strong> Date Range:</strong> Last {results.dateRange} days
              </p>
            </div>

            <div className="grid gap-6">
              {results.companies.map((company, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{company.companyName || `Company ${index + 1}`}</h3>
                      <p className="text-gray-600 flex items-center mt-1">
                        <Globe className="mr-1 h-4 w-4" />
                        {company.websiteUrl}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {company.verified ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Verified
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                          <AlertCircle className="mr-1 h-4 w-4" />
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700">
                    <strong>Lookup Method:</strong> Website URL across all platforms • <strong>Status:</strong> {company.verified ? 'Company name verified' : 'Company name not verified'}
                  </div>

                  {/* Platform Results */}
                  <div className="grid gap-4">
                    {/* Facebook */}
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-blue-900 flex items-center">
                          <div className="w-6 h-6 bg-blue-600 rounded mr-2 flex items-center justify-center text-white text-xs font-bold">F</div>
                          Facebook Ads Library
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          company.platforms.facebook.found 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {company.platforms.facebook.found ? 'Found' : 'Not Found'}
                        </span>
                      </div>
                      {company.platforms.facebook.found ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{company.platforms.facebook.activeAds}</p>
                            <p className="text-sm text-blue-700">Active Ads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{company.platforms.facebook.newAds}</p>
                            <p className="text-sm text-green-700">New Ads ({results.dateRange}d)</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-center">No ads found on Facebook</p>
                      )}
                    </div>

                    {/* Instagram */}
                    <div className="border rounded-lg p-4 bg-pink-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-pink-900 flex items-center">
                          <div className="w-6 h-6 bg-pink-600 rounded mr-2 flex items-center justify-center text-white text-xs font-bold">I</div>
                          Instagram Ads Library
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          company.platforms.instagram.found 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {company.platforms.instagram.found ? 'Found' : 'Not Found'}
                        </span>
                      </div>
                      {company.platforms.instagram.found ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-pink-600">{company.platforms.instagram.activeAds}</p>
                            <p className="text-sm text-pink-700">Active Ads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{company.platforms.instagram.newAds}</p>
                            <p className="text-sm text-green-700">New Ads ({results.dateRange}d)</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-center">No ads found on Instagram</p>
                      )}
                    </div>

                    {/* Bing */}
                    <div className="border rounded-lg p-4 bg-orange-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-orange-900 flex items-center">
                          <div className="w-6 h-6 bg-orange-600 rounded mr-2 flex items-center justify-center text-white text-xs font-bold">B</div>
                          Bing Ads Library
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          company.platforms.bing.found 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {company.platforms.bing.found ? 'Found' : 'Not Found'}
                        </span>
                      </div>
                      {company.platforms.bing.found ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-orange-600">{company.platforms.bing.activeAds}</p>
                            <p className="text-sm text-orange-700">Active Ads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{company.platforms.bing.newAds}</p>
                            <p className="text-sm text-green-700">New Ads ({results.dateRange}d)</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-center">No ads found on Bing</p>
                      )}
                    </div>

                    {/* TikTok */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                          <div className="w-6 h-6 bg-black rounded mr-2 flex items-center justify-center text-white text-xs font-bold">T</div>
                          TikTok Ads Library
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          company.platforms.tiktok.found 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {company.platforms.tiktok.found ? 'Found' : 'Not Found'}
                        </span>
                      </div>
                      {company.platforms.tiktok.found ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-800">{company.platforms.tiktok.activeAds}</p>
                            <p className="text-sm text-gray-700">Active Ads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{company.platforms.tiktok.newAds}</p>
                            <p className="text-sm text-green-700">New Ads ({results.dateRange}d)</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-center">No ads found on TikTok</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Multi-Platform Summary */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Multi-Platform Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Facebook Summary */}
                <div className="text-center">
                  <div className="w-8 h-8 bg-blue-600 rounded mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">F</div>
                  <p className="text-xl font-bold text-blue-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.facebook.found ? c.platforms.facebook.activeAds : 0), 0)}
                  </p>
                  <p className="text-xs text-gray-600">Facebook Active</p>
                  <p className="text-sm font-semibold text-green-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.facebook.found ? c.platforms.facebook.newAds : 0), 0)} new
                  </p>
                </div>
                
                {/* Instagram Summary */}
                <div className="text-center">
                  <div className="w-8 h-8 bg-pink-600 rounded mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">I</div>
                  <p className="text-xl font-bold text-pink-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.instagram.found ? c.platforms.instagram.activeAds : 0), 0)}
                  </p>
                  <p className="text-xs text-gray-600">Instagram Active</p>
                  <p className="text-sm font-semibold text-green-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.instagram.found ? c.platforms.instagram.newAds : 0), 0)} new
                  </p>
                </div>
                
                {/* Bing Summary */}
                <div className="text-center">
                  <div className="w-8 h-8 bg-orange-600 rounded mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">B</div>
                  <p className="text-xl font-bold text-orange-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.bing.found ? c.platforms.bing.activeAds : 0), 0)}
                  </p>
                  <p className="text-xs text-gray-600">Bing Active</p>
                  <p className="text-sm font-semibold text-green-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.bing.found ? c.platforms.bing.newAds : 0), 0)} new
                  </p>
                </div>
                
                {/* TikTok Summary */}
                <div className="text-center">
                  <div className="w-8 h-8 bg-black rounded mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold">T</div>
                  <p className="text-xl font-bold text-gray-800">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.tiktok.found ? c.platforms.tiktok.activeAds : 0), 0)}
                  </p>
                  <p className="text-xs text-gray-600">TikTok Active</p>
                  <p className="text-sm font-semibold text-green-600">
                    {results.companies.reduce((sum, c) => sum + (c.platforms.tiktok.found ? c.platforms.tiktok.newAds : 0), 0)} new
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {results.companies.length}
                    </p>
                    <p className="text-sm text-gray-600">Companies Analyzed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {results.companies.reduce((sum, c) => 
                        sum + Object.values(c.platforms).reduce((pSum, p) => pSum + (p.found ? p.activeAds : 0), 0), 0
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Total Active Ads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      {results.companies.reduce((sum, c) => 
                        sum + Object.values(c.platforms).reduce((pSum, p) => pSum + (p.found ? p.newAds : 0), 0), 0
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Total New Ads</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by OpenAI Agent Mode • Multi-Platform Analysis • Ready for Vercel deployment</p>
        </div>
      </div>
    </div>
  );
}
