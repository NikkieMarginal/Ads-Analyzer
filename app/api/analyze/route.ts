import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import axios from 'axios'

interface CompanyInput {
  companyName: string
  websiteUrl: string
}

interface CompanyResult {
  companyName: string
  websiteUrl: string
  activeAds: number | null
  newAds: number | null
  found: boolean
  error?: string
}

async function scrapeFacebookAdsWithBrowserless(
  companyName: string, 
  websiteUrl: string, 
  dateRange: number,
  browserlessApiKey: string
) {
  try {
    console.log(`Scraping Facebook Ads Library for company: "${companyName}"`)
    
    // Clean the company name for better search results
    const cleanCompanyName = companyName.trim().replace(/[^\w\s]/g, '').trim()
    
    // Facebook Ads Library URL - search by company name only
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(cleanCompanyName)}&search_type=keyword_unordered&media_type=all`
    
    console.log(`Search URL: ${searchUrl}`)
    
    // Try the basic /scrape endpoint which should work on free plans
    const browserlessResponse = await axios.post(
      `https://chrome.browserless.io/scrape?token=${browserlessApiKey}`,
      {
        url: searchUrl,
        elements: [
          {
            selector: "body"
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )

    console.log('✅ Browserless response received')
    
    const scrapedData = browserlessResponse.data
    
    if (!scrapedData || !Array.isArray(scrapedData) || !scrapedData[0] || !scrapedData[0].html) {
      console.error('Invalid response format:', scrapedData)
      throw new Error('No HTML content received from Browserless')
    }

    const htmlContent = scrapedData[0].html
    console.log('📄 HTML content length:', htmlContent.length)

    const bodyText = htmlContent.toLowerCase()
    
    // Check for "no results" indicators
    const noResultsIndicators = [
      'no results found',
      'we couldn\'t find any results', 
      'try a different search',
      'no ads to show',
      'no results',
      'nothing to show here',
      'no active ads',
      'try different keywords'
    ]
    
    const hasNoResults = noResultsIndicators.some(indicator => 
      bodyText.includes(indicator)
    )

    if (hasNoResults) {
      console.log(`❌ No results found for "${companyName}"`)
      return {
        found: false,
        activeAds: null,
        newAds: null,
        error: 'No ads found in Facebook Ads Library'
      }
    }

    // Extract domain from website URL for verification
    const websiteDomain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
    console.log(`🔍 Looking for domain: ${websiteDomain}`)

    // Check if the website domain appears in the HTML (for verification)
    const domainAppears = bodyText.includes(websiteDomain)
    
    // Check if company name appears in results
    const companyNameAppears = bodyText.includes(cleanCompanyName.toLowerCase()) ||
                              bodyText.includes(companyName.toLowerCase())

    console.log(`👤 Company name "${companyName}" appears: ${companyNameAppears}`)
    console.log(`🌐 Website domain "${websiteDomain}" appears: ${domainAppears}`)

    // Count ads using simple but effective methods
    let adCount = 0
    
    // Method 1: Count "Sponsored" text (most reliable)
    const sponsoredMatches = (htmlContent.match(/sponsored/gi) || []).length
    console.log(`📊 Found ${sponsoredMatches} "sponsored" mentions`)
    
    // Method 2: Count "Ad" labels in typical Facebook format
    const adLabelMatches = (htmlContent.match(/>\s*Ad\s*</gi) || []).length
    console.log(`📊 Found ${adLabelMatches} "Ad" labels`)
    
    // Method 3: Look for data attributes commonly used in Facebook ads
    const dataTestMatches = (htmlContent.match(/data-testid="[^"]*ad[^"]*"/gi) || []).length
    console.log(`📊 Found ${dataTestMatches} ad data attributes`)
    
    // Use the highest count from our methods
    adCount = Math.max(sponsoredMatches, adLabelMatches, dataTestMatches)
    
    // If we have very few results, try alternative counting
    if (adCount < 3) {
      // Look for article elements (Facebook often uses these for ads)
      const articleMatches = (htmlContent.match(/<article[^>]*>/gi) || []).length
      console.log(`📊 Found ${articleMatches} article elements`)
      adCount = Math.max(adCount, Math.min(articleMatches, 20)) // Cap at 20
    }

    console.log(`📈 Final ad count: ${adCount}`)

    // Verification and results
    if (adCount === 0) {
      if (companyNameAppears) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: `Found "${companyName}" but no active ads detected`
        }
      } else {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: `Company "${companyName}" not found in Facebook Ads Library`
        }
      }
    }

    // We found ads! Estimate new ads based on date range
    const newAdsRatio = dateRange <= 7 ? 0.15 : dateRange <= 30 ? 0.25 : 0.4
    const estimatedNewAds = Math.ceil(adCount * newAdsRatio)

    // Add verification warning if needed
    let resultError = null
    if (!domainAppears && !companyNameAppears) {
      resultError = `Found ${adCount} ads but verification uncertain - please review results`
    }

    console.log(`✅ SUCCESS: "${companyName}" - ${adCount} active ads, ${estimatedNewAds} new ads`)

    return {
      found: true,
      activeAds: adCount,
      newAds: estimatedNewAds,
      error: resultError
    }

  } catch (error) {
    console.error(`💥 Error scraping "${companyName}":`, error)
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const statusText = error.response?.statusText
      console.error(`HTTP Error: ${status} ${statusText}`)
      
      if (status === 429) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: 'Rate limit exceeded - please wait and try again'
        }
      }
    }
    
    return {
      found: false,
      activeAds: null,
      newAds: null,
      error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { openaiApiKey, browserlessApiKey, companies, dateRange } = await request.json()
    console.log('🚀 Starting analysis for', companies.length, 'companies')

    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 })
    }

    if (!browserlessApiKey) {
      return NextResponse.json({ error: 'Browserless API key is required' }, { status: 400 })
    }

    // Test connection with the simplest possible request
    try {
      console.log('🧪 Testing Browserless with simple request...')
      
      const testResponse = await axios.post(
        `https://chrome.browserless.io/scrape?token=${browserlessApiKey}`,
        {
          url: 'https://example.com',
          elements: [
            {
              selector: "title"
            }
          ]
        },
        { 
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log('✅ Browserless test successful!')
      console.log('Test response:', testResponse.data?.[0]?.text || 'No text found')
      
    } catch (testError) {
      console.error('❌ Browserless test failed:', testError)
      
      let errorMessage = 'Browserless API connection failed. '
      
      if (axios.isAxiosError(testError)) {
        const status = testError.response?.status
        const data = testError.response?.data
        
        console.error('Error response:', { status, data })
        
        if (status === 401) {
          errorMessage += 'Invalid API key. Please verify your Browserless.io API key.'
        } else if (status === 403) {
          errorMessage += 'Access denied. Your free plan might not support this endpoint. Try upgrading or contact Browserless support.'
        } else if (status === 429) {
          errorMessage += 'Rate limit exceeded. Please wait and try again.'
        } else {
          errorMessage += `HTTP ${status}: ${testError.response?.statusText || 'Unknown error'}`
        }
      } else {
        errorMessage += testError instanceof Error ? testError.message : 'Network error'
      }
      
      return NextResponse.json({ 
        error: errorMessage
      }, { status: 400 })
    }

    const results: CompanyResult[] = []

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i] as CompanyInput
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`\n📊 Processing ${i + 1}/${companies.length}: "${company.companyName}"`)
        
        const scrapingResult = await scrapeFacebookAdsWithBrowserless(
          company.companyName,
          company.websiteUrl,
          dateRange,
          browserlessApiKey
        )

        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: scrapingResult.activeAds,
          newAds: scrapingResult.newAds,
          found: scrapingResult.found,
          error: scrapingResult.error || undefined
        })

        // Longer delay to stay within rate limits
        if (i < companies.length - 1) {
          console.log('⏱️  Waiting 6 seconds before next request...')
          await new Promise(resolve => setTimeout(resolve, 6000))
        }

      } catch (error) {
        console.error(`❌ Error processing "${company.companyName}":`, error)
        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: null,
          newAds: null,
          found: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        })
      }
    }

    console.log('\n🎉 Analysis complete!')

    return NextResponse.json({
      companies: results,
      dateRange,
      analysisDate: new Date().toISOString().split('T')[0],
      dataSource: 'Facebook Ads Library (via Browserless.io)'
    })

  } catch (error) {
    console.error('💥 API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
