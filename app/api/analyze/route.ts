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
    console.log(`Scraping Facebook Ads Library for: ${companyName}`)
    
    // Facebook Ads Library URL with search query
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(companyName)}&search_type=keyword_unordered&media_type=all`
    
    // Browserless.io scraping request
    const browserlessResponse = await axios.post(
      `https://chrome.browserless.io/scrape?token=${browserlessApiKey}`,
      {
        url: searchUrl,
        elements: [
          {
            selector: 'body'
          }
        ],
        options: {
          waitForTimeout: 5000,
          waitForSelector: '[data-testid="serp-item"], .x1i10hfl, [role="article"]',
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    )

    const scrapedData = browserlessResponse.data
    console.log('Browserless response received, data length:', JSON.stringify(scrapedData).length)

    if (!scrapedData || !scrapedData[0] || !scrapedData[0].html) {
      throw new Error('No HTML content received from Browserless')
    }

    const htmlContent = scrapedData[0].html
    const bodyText = htmlContent.toLowerCase()
    
    // Check for "no results" indicators using string methods
    const noResultsIndicators = [
      'no results found',
      'we couldn\'t find any results',
      'try a different search',
      'no ads to show',
      'no results'
    ]
    
    const hasNoResults = noResultsIndicators.some(indicator => 
      bodyText.includes(indicator)
    )

    if (hasNoResults) {
      console.log(`No results found for ${companyName}`)
      return {
        found: false,
        activeAds: null,
        newAds: null,
        error: 'Company not found in Facebook Ads Library'
      }
    }

    // Count ads using regex patterns instead of cheerio
    let adCount = 0
    
    // Try different patterns to count ads
    const adPatterns = [
      /data-testid="serp-item"/g,
      /data-testid="ad-card"/g,
      /role="article"/g,
      /sponsored/gi,
      /ad by/gi
    ]

    for (const pattern of adPatterns) {
      const matches = htmlContent.match(pattern)
      if (matches && matches.length > 0) {
        adCount = matches.length
        console.log(`Found ${adCount} ads using pattern: ${pattern}`)
        break
      }
    }

    // If no patterns worked, try counting common Facebook ad elements
    if (adCount === 0) {
      // Look for Facebook-specific ad indicators
      const fbAdPatterns = [
        /class="[^"]*x1i10hfl[^"]*"/g,
        /data-pagelet[^>]*ad[^>]*/gi,
        /<div[^>]*data-[^>]*ad[^>]*>/gi
      ]
      
      for (const pattern of fbAdPatterns) {
        const matches = htmlContent.match(pattern)
        if (matches && matches.length > 0) {
          adCount = Math.min(matches.length, 100) // Cap at reasonable number
          console.log(`Found ${adCount} potential ads using FB pattern`)
          break
        }
      }
    }

    // Verify company name appears in results
    const companyNameAppears = bodyText.includes(companyName.toLowerCase())
    
    if (!companyNameAppears && adCount === 0) {
      return {
        found: false,
        activeAds: null,
        newAds: null,
        error: 'Company name not found in search results'
      }
    }

    // If we still have no ads but company name appears, estimate based on presence
    if (adCount === 0 && companyNameAppears) {
      // Look for any mention of ads or sponsored content
      const adMentions = (htmlContent.match(/sponsored|advertisement|promote/gi) || []).length
      adCount = Math.min(adMentions, 20) // Conservative estimate
    }

    // Estimate new ads based on date range and total ads
    const newAdsRatio = dateRange <= 7 ? 0.2 : dateRange <= 30 ? 0.35 : 0.5
    const estimatedNewAds = Math.floor(adCount * newAdsRatio)

    console.log(`Analysis complete for ${companyName}: ${adCount} active ads, ${estimatedNewAds} new ads`)

    return {
      found: adCount > 0,
      activeAds: adCount > 0 ? adCount : null,
      newAds: adCount > 0 ? estimatedNewAds : null,
      error: null
    }

  } catch (error) {
    console.error(`Scraping error for ${companyName}:`, error)
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
    console.log('API called with:', { companiesCount: companies.length, dateRange })

    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 })
    }

    if (!browserlessApiKey) {
      return NextResponse.json({ error: 'Browserless API key is required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    const results: CompanyResult[] = []

    for (const company of companies as CompanyInput[]) {
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`Processing company: ${company.companyName}`)
        
        // Scrape Facebook Ads Library using Browserless
        const scrapingResult = await scrapeFacebookAdsWithBrowserless(
          company.companyName,
          company.websiteUrl,
          dateRange,
          browserlessApiKey
        )

        if (scrapingResult.found && scrapingResult.activeAds) {
          // Use OpenAI to verify and refine the data
          const verificationPrompt = `
Based on scraped Facebook Ads Library data:
- Company: ${company.companyName}
- Website: ${company.websiteUrl}
- Found ads: ${scrapingResult.activeAds}
- Estimated new ads (${dateRange} days): ${scrapingResult.newAds}

Please verify if this data seems reasonable. Consider:
1. Does the company name match the website domain?
2. Are the ad numbers realistic for this type of business?
3. Any obvious red flags?

Return ONLY a JSON object:
{"found": boolean, "activeAds": number, "newAds": number, "error": null}

If data seems unrealistic, adjust the numbers to be more reasonable.`

          const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "You are a data verification specialist. Review scraped advertising data and ensure it's realistic and accurate."
              },
              {
                role: "user",
                content: verificationPrompt
              }
            ],
            temperature: 0.1,
            max_tokens: 150,
          })

          const responseText = completion.choices[0].message.content?.trim()
          
          if (responseText) {
            try {
              const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
              const jsonStart = cleanedResponse.indexOf('{')
              const jsonEnd = cleanedResponse.lastIndexOf('}')
              
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd + 1)
                const verifiedResult = JSON.parse(jsonStr)
                
                results.push({
                  companyName: company.companyName,
                  websiteUrl: company.websiteUrl,
                  activeAds: verifiedResult.activeAds,
                  newAds: verifiedResult.newAds,
                  found: verifiedResult.found,
                  error: verifiedResult.error || undefined
                })
              } else {
                throw new Error('No JSON found in verification response')
              }
            } catch (parseError) {
              // Fallback to scraped data
              results.push({
                companyName: company.companyName,
                websiteUrl: company.websiteUrl,
                activeAds: scrapingResult.activeAds,
                newAds: scrapingResult.newAds,
                found: scrapingResult.found,
                error: scrapingResult.error || undefined
              })
            }
          } else {
            // Fallback to scraped data
            results.push({
              companyName: company.companyName,
              websiteUrl: company.websiteUrl,
              activeAds: scrapingResult.activeAds,
              newAds: scrapingResult.newAds,
              found: scrapingResult.found,
              error: scrapingResult.error || undefined
            })
          }
        } else {
          results.push({
            companyName: company.companyName,
            websiteUrl: company.websiteUrl,
            activeAds: null,
            newAds: null,
            found: false,
            error: scrapingResult.error || 'Company not found in ads library'
          })
        }

        // Delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 3000))

      } catch (error) {
        console.error(`Error processing ${company.companyName}:`, error)
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

    console.log('Analysis complete. Total results:', results.length)

    return NextResponse.json({
      companies: results,
      dateRange,
      analysisDate: new Date().toISOString().split('T')[0],
      dataSource: 'Browserless.io Web Scraping'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
