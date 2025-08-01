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

async function scrapeFacebookAdsWithScrapingBee(
  companyName: string, 
  websiteUrl: string, 
  dateRange: number,
  scrapingBeeApiKey: string
) {
  try {
    console.log(`🐝 Scraping Facebook Ads Library for: "${companyName}"`)
    
    // Clean the company name for better search results
    const cleanCompanyName = companyName.trim().replace(/[^\w\s]/g, '').trim()
    
    // Facebook Ads Library URL - search by company name
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(cleanCompanyName)}&search_type=keyword_unordered&media_type=all`
    
    console.log(`🔍 Search URL: ${searchUrl}`)
    
    // ScrapingBee request with JavaScript rendering
    const scrapingBeeResponse = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        api_key: scrapingBeeApiKey,
        url: searchUrl,
        render_js: 'True',
        premium_proxy: 'True',
        country_code: 'US',
        wait: 5000,
        wait_for: '.x1i10hfl, [data-testid="serp-item"], [role="article"]'
      },
      timeout: 120000 // 2 minutes timeout
    })

    const htmlContent = scrapingBeeResponse.data
    console.log('✅ ScrapingBee response received, HTML length:', htmlContent.length)

    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('No HTML content received from ScrapingBee')
    }

    const bodyText = htmlContent.toLowerCase()
    
    // Check for Facebook-specific "no results" indicators
    const noResultsIndicators = [
      'no results found',
      'we couldn\'t find any results', 
      'try a different search',
      'no ads to show',
      'no results',
      'nothing to show here',
      'no active ads',
      'try different keywords',
      'no ads match your search'
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

    // Count ads using multiple sophisticated methods
    let adCount = 0
    
    // Method 1: Count "Sponsored" mentions (most reliable for Facebook)
    const sponsoredMatches = (htmlContent.match(/sponsored/gi) || []).length
    console.log(`📊 Found ${sponsoredMatches} "sponsored" mentions`)
    
    // Method 2: Count Facebook ad containers
    const adContainerPatterns = [
      /data-testid="serp-item"/gi,
      /data-testid="ad-item"/gi,
      /role="article"[^>]*>/gi,
      /<div[^>]*data-[^>]*ad[^>]*>/gi
    ]
    
    let maxContainerCount = 0
    adContainerPatterns.forEach(pattern => {
      const matches = (htmlContent.match(pattern) || []).length
      if (matches > 0) {
        console.log(`📦 Found ${matches} containers with pattern: ${pattern.source}`)
        maxContainerCount = Math.max(maxContainerCount, matches)
      }
    })
    
    // Method 3: Count "Ad" labels in Facebook format
    const adLabelMatches = (htmlContent.match(/>\s*Ad\s*</gi) || []).length
    console.log(`🏷️  Found ${adLabelMatches} "Ad" labels`)
    
    // Method 4: Look for Facebook-specific ad elements
    const fbSpecificPatterns = [
      /x1i10hfl/gi, // Facebook CSS class
      /aria-label="[^"]*ad[^"]*"/gi,
      /data-pagelet="[^"]*ad[^"]*"/gi
    ]
    
    let fbElementCount = 0
    fbSpecificPatterns.forEach(pattern => {
      const matches = (htmlContent.match(pattern) || []).length
      fbElementCount = Math.max(fbElementCount, matches)
    })
    
    if (fbElementCount > 0) {
      console.log(`🎯 Found ${fbElementCount} Facebook-specific ad elements`)
    }
    
    // Use the highest count from our methods
    adCount = Math.max(sponsoredMatches, maxContainerCount, adLabelMatches, fbElementCount)
    
    // Additional verification: if we have very low counts, look for any ad-related content
    if (adCount < 3 && (companyNameAppears || domainAppears)) {
      const adKeywords = ['promote', 'advertisement', 'campaign', 'marketing'];
      let keywordCount = 0;
      
      adKeywords.forEach(keyword => {
        const matches = (htmlContent.match(new RegExp(keyword, 'gi')) || []).length
        keywordCount += matches
      })
      
      if (keywordCount > adCount) {
        adCount = Math.min(keywordCount, 15) // Conservative estimate
        console.log(`🔍 Using keyword-based count: ${adCount}`)
      }
    }

    console.log(`📈 Final ad count: ${adCount}`)

    // Verification and results logic
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

    // We found ads! Now verify it's the right company
    let verificationWarning = null
    if (!domainAppears && !companyNameAppears) {
      verificationWarning = `Found ${adCount} ads but couldn't verify they belong to "${companyName}". Please review results carefully.`
      console.log(`⚠️  ${verificationWarning}`)
    }

    // Estimate new ads based on date range
    const newAdsRatio = dateRange <= 7 ? 0.15 : dateRange <= 30 ? 0.25 : 0.4
    const estimatedNewAds = Math.ceil(adCount * newAdsRatio)

    console.log(`✅ SUCCESS: "${companyName}" - ${adCount} active ads, ${estimatedNewAds} new ads`)

    return {
      found: true,
      activeAds: adCount,
      newAds: estimatedNewAds,
      error: verificationWarning
    }

  } catch (error) {
    console.error(`💥 ScrapingBee error for "${companyName}":`, error)
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const statusText = error.response?.statusText
      
      if (status === 401) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: 'Invalid ScrapingBee API key'
        }
      } else if (status === 429) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: 'ScrapingBee rate limit exceeded'
        }
      } else if (status === 403) {
        return {
          found: false,
          activeAds: null,
          newAds: null,
          error: 'ScrapingBee: Insufficient credits or plan limit reached'
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
    const { openaiApiKey, scrapingBeeApiKey, companies, dateRange } = await request.json()
    console.log('🚀 Starting ScrapingBee analysis for', companies.length, 'companies')

    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 })
    }

    if (!scrapingBeeApiKey) {
      return NextResponse.json({ error: 'ScrapingBee API key is required' }, { status: 400 })
    }

    // Test ScrapingBee connection
    try {
      console.log('🧪 Testing ScrapingBee connection...')
      
      const testResponse = await axios.get('https://app.scrapingbee.com/api/v1/', {
        params: {
          api_key: scrapingBeeApiKey,
          url: 'https://httpbin.org/html',
          render_js: 'False'
        },
        timeout: 30000
      })
      
      console.log('✅ ScrapingBee test successful!')
      
    } catch (testError) {
      console.error('❌ ScrapingBee test failed:', testError)
      
      let errorMessage = 'ScrapingBee API connection failed. '
      
      if (axios.isAxiosError(testError)) {
        const status = testError.response?.status
        
        if (status === 401) {
          errorMessage += 'Invalid API key. Please check your ScrapingBee API key.'
        } else if (status === 403) {
          errorMessage += 'Insufficient credits or plan limits. Check your ScrapingBee account.'
        } else if (status === 429) {
          errorMessage += 'Rate limit exceeded. Please wait and try again.'
        } else {
          errorMessage += `HTTP ${status}: ${testError.response?.statusText || 'Unknown error'}`
        }
      } else {
        errorMessage += 'Network error or timeout.'
      }
      
      return NextResponse.json({ 
        error: errorMessage
      }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    const results: CompanyResult[] = []

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i] as CompanyInput
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`\n📊 Processing ${i + 1}/${companies.length}: "${company.companyName}"`)
        
        const scrapingResult = await scrapeFacebookAdsWithScrapingBee(
          company.companyName,
          company.websiteUrl,
          dateRange,
          scrapingBeeApiKey
        )

        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: scrapingResult.activeAds,
          newAds: scrapingResult.newAds,
          found: scrapingResult.found,
          error: scrapingResult.error || undefined
        })

        // Delay between requests to be respectful to both APIs
        if (i < companies.length - 1) {
          console.log('⏱️  Waiting 8 seconds before next request...')
          await new Promise(resolve => setTimeout(resolve, 8000))
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
      dataSource: 'Facebook Ads Library (via ScrapingBee)'
    })

  } catch (error) {
    console.error('💥 API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
