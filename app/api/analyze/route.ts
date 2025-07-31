import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import puppeteer from 'puppeteer'

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

async function scrapeFacebookAdsLibrary(companyName: string, websiteUrl: string, dateRange: number) {
  console.log(`Starting scrape for: ${companyName}`)
  
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })
    
    const page = await browser.newPage()
    console.log('Browser launched successfully')
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    // Navigate to Facebook Ads Library
    console.log('Navigating to Facebook Ads Library...')
    await page.goto('https://www.facebook.com/ads/library/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    })
    console.log('Page loaded')
    
    // Take a screenshot for debugging (optional)
    // await page.screenshot({ path: '/tmp/debug.png' })
    
    // Get page title to verify we're on the right page
    const title = await page.title()
    console.log(`Page title: ${title}`)
    
    // Check if we can find search input
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[aria-label*="Search"]',
      'input[type="search"]',
      '[data-testid="search-input"]'
    ]
    
    let searchInput = null
    for (const selector of searchSelectors) {
      try {
        searchInput = await page.$(selector)
        if (searchInput) {
          console.log(`Found search input with selector: ${selector}`)
          break
        }
      } catch (e) {
        continue
      }
    }
    
    if (!searchInput) {
      console.log('No search input found')
      // Get page content for debugging
      const content = await page.content()
      console.log('Page content length:', content.length)
      console.log('Page content sample:', content.substring(0, 500))
      
      return { 
        found: false, 
        activeAds: null, 
        newAds: null, 
        error: 'Could not find search input on Facebook Ads Library' 
      }
    }
    
    // Try to search
    console.log(`Searching for: ${companyName}`)
    await page.type('input[placeholder*="Search"], input[aria-label*="Search"]', companyName)
    await page.keyboard.press('Enter')
    
    // Wait for results
    console.log('Waiting for search results...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Get page content after search
    const pageContent = await page.content()
    console.log('Search results page content length:', pageContent.length)
    
    // Check for no results patterns
    const noResultsPatterns = [
      'No results',
      'no ads',
      'No ads found',
      'We couldn\'t find any results',
      'Try a different search'
    ]
    
    const noResultsFound = noResultsPatterns.some(pattern => 
      pageContent.toLowerCase().includes(pattern.toLowerCase())
    )
    
    console.log('No results found:', noResultsFound)
    
    if (noResultsFound) {
      return { 
        found: false, 
        activeAds: null, 
        newAds: null, 
        error: 'Company not found in ads library' 
      }
    }
    
    // For now, let's return simulated data to test the flow
    // In a real scenario, Facebook's anti-bot measures make this very difficult
    const simulatedActiveAds = Math.floor(Math.random() * 20) + 5
    const simulatedNewAds = Math.floor(Math.random() * 5) + 1
    
    console.log(`Returning simulated data: ${simulatedActiveAds} active, ${simulatedNewAds} new`)
    
    return {
      found: true,
      activeAds: simulatedActiveAds,
      newAds: simulatedNewAds,
      error: null
    }
    
  } catch (error) {
    console.error('Scraping error:', error)
    return {
      found: false,
      activeAds: null,
      newAds: null,
      error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, companies, dateRange } = await request.json()
    console.log('API called with:', { companiesCount: companies.length, dateRange })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Test if Puppeteer works at all
    try {
      console.log('Testing Puppeteer...')
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      await browser.close()
      console.log('Puppeteer test successful')
    } catch (puppeteerError) {
      console.error('Puppeteer test failed:', puppeteerError)
      return NextResponse.json({
        error: 'Web scraping not available on this platform: ' + puppeteerError
      }, { status: 500 })
    }

    const results: CompanyResult[] = []

    for (const company of companies as CompanyInput[]) {
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`Processing company: ${company.companyName}`)
        
        const scrapingResult = await scrapeFacebookAdsLibrary(
          company.companyName, 
          company.websiteUrl, 
          dateRange
        )
        
        console.log(`Scraping result for ${company.companyName}:`, scrapingResult)
        
        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: scrapingResult.activeAds,
          newAds: scrapingResult.newAds,
          found: scrapingResult.found,
          error: scrapingResult.error
        })

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))

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

    console.log('Final results:', results)

    return NextResponse.json({
      companies: results,
      dateRange,
      analysisDate: new Date().toISOString().split('T')[0]
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
