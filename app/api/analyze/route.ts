import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import axios from 'axios'

interface CompanyInput {
  companyName: string
  websiteUrl: string
  facebookUrl?: string
}

interface CompanyResult {
  companyName: string
  websiteUrl: string
  facebookUrl: string
  activeAds: number | null
  newAds: number | null
  found: boolean
  error?: string
}

function extractSocialHandles(facebookUrl: string): string[] {
  if (!facebookUrl) return []
  
  try {
    // Extract main handle from Facebook URL
    const patterns = [
      /facebook\.com\/([^\/\?#]+)/i,
      /fb\.com\/([^\/\?#]+)/i,
      /m\.facebook\.com\/([^\/\?#]+)/i
    ]
    
    let mainHandle = null
    for (const pattern of patterns) {
      const match = facebookUrl.match(pattern)
      if (match && match[1]) {
        mainHandle = match[1].replace(/\/$/, '').replace(/\?.*$/, '').replace(/#.*$/, '')
        break
      }
    }
    
    if (!mainHandle) {
      console.log(`⚠️  Could not extract handle from Facebook URL: ${facebookUrl}`)
      return []
    }
    
    // Generate possible handle variations
    const handles = [
      mainHandle,
      mainHandle.toLowerCase(),
      mainHandle.replace(/[^a-zA-Z0-9]/g, ''), // Remove special characters
      mainHandle.replace(/service|aps|as|ltd|inc|llc|corp/gi, '').trim(), // Remove common business suffixes
    ]
    
    // Add Instagram variations (common patterns)
    const instagramVariations = [
      `${mainHandle}insta`,
      `${mainHandle}_official`,
      `${mainHandle}.official`,
      `${mainHandle}_ig`,
      mainHandle.replace(/service|aps/gi, '') // Common for Danish companies
    ]
    
    handles.push(...instagramVariations)
    
    // Remove duplicates and empty strings
    const uniqueHandles = Array.from(new Set(handles)).filter(h => h && h.length > 2)
    
    console.log(`📘 Generated handle variations for verification:`, uniqueHandles)
    return uniqueHandles
    
  } catch (error) {
    console.error('Error extracting social handles:', error)
    return []
  }
}

async function scrapeFacebookAdsWithScrapingBee(
  companyName: string, 
  websiteUrl: string,
  facebookUrl: string | undefined,
  dateRange: number,
  scrapingBeeApiKey: string
) {
  try {
    console.log(`🐝 Scraping Facebook Ads Library for: "${companyName}"`)
    
    // Extract possible social media handles
    const socialHandles = facebookUrl ? extractSocialHandles(facebookUrl) : []
    console.log(`🎯 Social handles for verification: ${socialHandles.length} variations`)
    
    // Clean the company name
    const cleanCompanyName = companyName.trim().replace(/[^\w\s]/g, '').trim()
    
    // Facebook Ads Library URL
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(cleanCompanyName)}&search_type=keyword_unordered&media_type=all`
    
    console.log(`🔍 Search URL: ${searchUrl}`)
    
    // ScrapingBee request
    const scrapingBeeResponse = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        api_key: scrapingBeeApiKey,
        url: searchUrl,
        render_js: 'True',
        premium_proxy: 'True',
        country_code: 'US',
        wait: 10000, // Wait longer for content to fully load
        wait_for: '.x1i10hfl, [data-testid="serp-item"], [role="article"]'
      },
      timeout: 180000 // 3 minutes timeout
    })

    const htmlContent = scrapingBeeResponse.data
    console.log('✅ ScrapingBee response received, HTML length:', htmlContent.length)

    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('No HTML content received from ScrapingBee')
    }

    const bodyText = htmlContent.toLowerCase()
    
    // Check for no results
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

    // Verification using multiple methods
    const websiteDomain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
    const domainAppears = bodyText.includes(websiteDomain)
    const companyNameAppears = bodyText.includes(cleanCompanyName.toLowerCase()) || bodyText.includes(companyName.toLowerCase())
    
    // Enhanced social handle verification
    let socialHandleVerified = false
    let matchedHandle = null
    
    if (socialHandles.length > 0) {
      console.log(`🔍 Searching for social handles in content...`)
      
      for (const handle of socialHandles) {
        const handlePatterns = [
          `@${handle.toLowerCase()}`,
          `@${handle}`,
          handle.toLowerCase(),
          `facebook.com/${handle.toLowerCase()}`,
          `/${handle.toLowerCase()}`,
          `"${handle.toLowerCase()}"`,
          `"${handle}"`
        ]
        
        for (const pattern of handlePatterns) {
          if (bodyText.includes(pattern) || htmlContent.includes(pattern)) {
            socialHandleVerified = true
            matchedHandle = handle
            console.log(`✅ Social handle verification successful: Found "${pattern}"`)
            break
          }
        }
        
        if (socialHandleVerified) break
      }
      
      if (!socialHandleVerified) {
        console.log(`⚠️  None of the social handles found in search results`)
        // Don't immediately fail - continue with domain/name verification
      }
    }

    console.log(`👤 Company name appears: ${companyNameAppears}`)
    console.log(`🌐 Website domain appears: ${domainAppears}`)
    console.log(`📘 Social handle verified: ${socialHandleVerified} ${matchedHandle ? `(@${matchedHandle})` : ''}`)

    // Improved ad counting with better filtering
    let adCount = 0
    
    if (socialHandleVerified && matchedHandle) {
      console.log(`🎯 Using precise counting with verified handle: @${matchedHandle}`)
      
      // Look for content blocks that contain both "sponsored" and the verified handle
      const contentBlocks = htmlContent.split(/<div[^>]*data-testid="serp-item"[^>]*>/gi)
      let verifiedAdCount = 0
      
      for (const block of contentBlocks) {
        const blockLower = block.toLowerCase()
        const blockContainsHandle = socialHandles.some(handle => 
          blockLower.includes(`@${handle.toLowerCase()}`) || 
          blockLower.includes(handle.toLowerCase())
        )
        const blockContainsSponsored = blockLower.includes('sponsored') || blockLower.includes('ad')
        
        if (blockContainsHandle && blockContainsSponsored) {
          verifiedAdCount++
        }
      }
      
      if (verifiedAdCount > 0) {
        adCount = verifiedAdCount
        console.log(`✅ Found ${verifiedAdCount} ads with verified handle`)
      } else {
        // Fallback: count ads in sections that mention the company
        const companyMentions = htmlContent.split(new RegExp(cleanCompanyName, 'gi'))
        const sponsoredNearCompany = companyMentions.filter(section => 
          section.toLowerCase().includes('sponsored') || 
          section.toLowerCase().includes('ad')
        ).length
        
        adCount = Math.min(sponsoredNearCompany, 20) // Conservative cap
        console.log(`📊 Fallback count near company mentions: ${adCount}`)
      }
      
    } else if (domainAppears) {
      console.log(`🌐 Using domain-based counting for ${websiteDomain}`)
      
      // Count sponsored content near domain mentions
      const domainMentions = htmlContent.split(new RegExp(websiteDomain, 'gi'))
      const sponsoredNearDomain = domainMentions.filter(section => 
        section.toLowerCase().includes('sponsored')
      ).length
      
      adCount = Math.min(sponsoredNearDomain, 30) // Cap at 30
      console.log(`📊 Found ${adCount} ads near domain mentions`)
      
    } else {
      console.log(`📊 Using general counting (less reliable)`)
      
      // General counting but with stricter limits
      const totalSponsored = (htmlContent.match(/sponsored/gi) || []).length
      const totalAdLabels = (htmlContent.match(/>\s*Ad\s*</gi) || []).length
      
      // Use a fraction of total count since we can't verify the company
      adCount = Math.min(Math.max(totalSponsored, totalAdLabels) * 0.1, 15)
      adCount = Math.floor(adCount)
      
      console.log(`📊 General count (10% of ${Math.max(totalSponsored, totalAdLabels)}): ${adCount}`)
    }

    console.log(`📈 Final ad count: ${adCount}`)

    // Results with improved verification
    if (adCount === 0) {
      if (companyNameAppears || domainAppears) {
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

    // If we have very low verification but high ad count, cap it more aggressively
    if (!socialHandleVerified && !domainAppears && adCount > 10) {
      adCount = Math.min(adCount, 10)
      console.log(`⚠️  Limited ad count to ${adCount} due to low verification confidence`)
    }

    const newAdsRatio = dateRange <= 7 ? 0.15 : dateRange <= 30 ? 0.25 : 0.4
    const estimatedNewAds = Math.ceil(adCount * newAdsRatio)

    // Verification status message
    let verificationMessage = null
    if (socialHandleVerified) {
      verificationMessage = `✅ Verified with social handle @${matchedHandle}`
    } else if (domainAppears) {
      verificationMessage = `✅ Verified with website domain ${websiteDomain}`
    } else if (companyNameAppears) {
      verificationMessage = `⚠️  Verified by company name only - results may include similar companies`
    } else {
      verificationMessage = `⚠️  Low verification confidence - please review results carefully`
    }

    console.log(`✅ SUCCESS: "${companyName}" - ${adCount} active ads, ${estimatedNewAds} new ads`)
    console.log(verificationMessage)

    return {
      found: true,
      activeAds: adCount,
      newAds: estimatedNewAds,
      error: verificationMessage?.startsWith('⚠️') ? verificationMessage : null
    }

  } catch (error) {
    console.error(`💥 ScrapingBee error for "${companyName}":`, error)
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      
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
          error: 'ScrapingBee: Insufficient credits'
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
    console.log('🚀 Starting enhanced Facebook verification analysis for', companies.length, 'companies')

    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 })
    }

    if (!scrapingBeeApiKey) {
      return NextResponse.json({ error: 'ScrapingBee API key is required' }, { status: 400 })
    }

    const results: CompanyResult[] = []

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i] as CompanyInput
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`\n📊 Processing ${i + 1}/${companies.length}: "${company.companyName}"`)
        if (company.facebookUrl) {
          console.log(`📘 Facebook page: ${company.facebookUrl}`)
        }
        
        const scrapingResult = await scrapeFacebookAdsWithScrapingBee(
          company.companyName,
          company.websiteUrl,
          company.facebookUrl,
          dateRange,
          scrapingBeeApiKey
        )

        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          facebookUrl: company.facebookUrl || '',
          activeAds: scrapingResult.activeAds,
          newAds: scrapingResult.newAds,
          found: scrapingResult.found,
          error: scrapingResult.error || undefined
        })

        // Wait between requests
        if (i < companies.length - 1) {
          console.log('⏱️  Waiting 12 seconds before next request...')
          await new Promise(resolve => setTimeout(resolve, 12000))
        }

      } catch (error) {
        console.error(`❌ Error processing "${company.companyName}":`, error)
        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          facebookUrl: company.facebookUrl || '',
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
      dataSource: 'Facebook Ads Library with Multi-Handle Verification (via ScrapingBee)'
    })

  } catch (error) {
    console.error('💥 API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
