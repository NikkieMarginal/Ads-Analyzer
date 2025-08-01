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
    
    // Browserless.io request using the correct endpoint
    const browserlessResponse = await axios.post(
      `https://chrome.browserless.io/content?token=${browserlessApiKey}`,
      {
        url: searchUrl,
        waitForTimeout: 10000,
        viewport: {
          width: 1920,
          height: 1080
        },
        setJavaScriptEnabled: true,
        addScriptTag: [{
          content: `
            // Wait for page to load and scroll to load more ads
            setTimeout(() => {
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => {
                window.scrollTo(0, document.body.scrollHeight);
              }, 2000);
            }, 3000);
          `
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90 seconds timeout
      }
    )

    const htmlContent = browserlessResponse.data
    console.log('✅ Browserless response received, HTML length:', htmlContent.length)

    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('No HTML content received from Browserless')
    }

    const bodyText = htmlContent.toLowerCase()
    
    // Check for "no results" indicators
    const noResultsIndicators = [
      'no results found',
      'we couldn\'t find any results', 
      'try a different search',
      'no ads to show',
      'no results',
      'nothing to show here',
      'no active ads'
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

    console.log(`👤 Company name "${companyName}" appears in results: ${companyNameAppears}`)
    console.log(`🌐 Website domain "${websiteDomain}" appears in results: ${domainAppears}`)

    // Count ads using multiple approaches
    let adCount = 0
    
    // Method 1: Look for "Sponsored" or "Ad" text
    const sponsoredMatches = htmlContent.match(/sponsored/gi) || []
    const adMatches = htmlContent.match(/>\s*ad\s*</gi) || []
    console.log(`📊 Found ${sponsoredMatches.length} "sponsored" mentions, ${adMatches.length} "ad" labels`)
    
    adCount = Math.max(sponsoredMatches.length, adMatches.length)

    // Method 2: Look for Facebook ad containers
    const containerPatterns = [
      /data-testid="serp-item"/gi,
      /role="article"/gi,
      /data-testid="ad-"/gi
    ]

    for (const pattern of containerPatterns) {
      const matches = htmlContent.match(pattern) || []
      if (matches.length > 0) {
        console.log(`📦 Found ${matches.length} containers with pattern: ${pattern.source}`)
        adCount = Math.max(adCount, matches.length)
      }
    }

    // Method 3: Look for ad-related divs and elements
    const adElementPatterns = [
      /<div[^>]*data-[^>]*ad[^>]*>/gi,
      /<div[^>]*aria-label="[^"]*ad[^"]*"[^>]*>/gi
    ]

    for (const pattern of adElementPatterns) {
      const matches = htmlContent.match(pattern) || []
      if (matches.length > 0) {
        console.log(`🎯 Found ${matches.length} ad elements`)
        adCount = Math.max(adCount, matches.length)
      }
    }

    console.log(`📈 Total ad count detected: ${adCount}`)

    // Verification logic
    if (adCount === 0) {
      if (!companyNameAppears) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: `Company "${companyName}" not found in Facebook Ads Library`
        }
      } else {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: `Company found but no active ads detected`
        }
      }
    }

    // If we found ads but can't verify the company, still return the data but with warning
    let verificationWarning = null
    if (adCount > 0 && !domainAppears && !companyNameAppears) {
      verificationWarning = `Found ${adCount} ads but couldn't fully verify they belong to "${companyName}". Please review results.`
      console.log(`⚠️  ${verificationWarning}`)
    }

    // Estimate new ads based on date range
    const newAdsRatio = dateRange <= 7 ? 0.15 : dateRange <= 30 ? 0.25 : 0.4
    const estimatedNewAds = Math.ceil(adCount * newAdsRatio)

    console.log(`✅ Success for "${companyName}": ${adCount} active ads, ${estimatedNewAds} estimated new ads`)

    return {
      found: true,
      activeAds: adCount,
      newAds: estimatedNewAds,
      error: verificationWarning || null
    }

  } catch (error) {
    console.error(`💥 Scraping error for "${companyName}":`, error)
    
    // More detailed error information
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const statusText = error.response?.statusText
      return {
        found: false,
        activeAds: null,
        newAds: null,
        error: `HTTP ${status}: ${statusText || 'Request failed'}`
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

    // Test Browserless connection with your actual API key format
    try {
      console.log('🧪 Testing Browserless connection with key:', browserlessApiKey.substring(0, 8) + '...')
      
      const testResponse = await axios.post(
        `https://chrome.browserless.io/content?token=${browserlessApiKey}`,
        {
          url: 'https://httpbin.org/json',
          waitForTimeout: 3000
        },
        { 
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log('✅ Browserless connection successful! Response length:', testResponse.data.length)
      
    } catch (testError) {
      console.error('❌ Browserless test failed:', testError)
      
      let errorMessage = 'Browserless API connection failed. '
      
      if (axios.isAxiosError(testError)) {
        const status = testError.response?.status
        const statusText = testError.response?.statusText
        
        if (status === 401) {
          errorMessage += 'Invalid API key. Please check your Browserless.io API key.'
        } else if (status === 403) {
          errorMessage += 'API key valid but access denied. Check your plan limits.'
        } else if (status === 429) {
          errorMessage += 'Rate limit exceeded. Please try again later.'
        } else if (status) {
          errorMessage += `HTTP ${status}: ${statusText}`
        } else {
          errorMessage += 'Network timeout or connection error.'
        }
      } else {
        errorMessage += testError instanceof Error ? testError.message : 'Unknown error'
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

        // Delay between requests
        if (i < companies.length - 1) {
          console.log('⏱️  Waiting 5 seconds before next request...')
          await new Promise(resolve => setTimeout(resolve, 5000))
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
    console.log('Results:', results.map(r => `${r.companyName}: ${r.found ? `${r.activeAds} ads` : 'not found'}`))

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
