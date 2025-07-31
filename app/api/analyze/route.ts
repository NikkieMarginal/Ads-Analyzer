import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

export async function POST(request: NextRequest) {
  try {
    const { apiKey, companies, dateRange } = await request.json()
    console.log('API called with:', { companiesCount: companies.length, dateRange })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const results: CompanyResult[] = []

    for (const company of companies as CompanyInput[]) {
      if (!company.companyName.trim()) continue
      
      try {
        console.log(`Analyzing company: ${company.companyName}`)
        
        // Use OpenAI to analyze the company and estimate Facebook ads data
        const prompt = `You are an AI agent with access to Facebook Ads Library data. Analyze the following company and provide realistic estimates:

Company Name: "${company.companyName}"
Website URL: "${company.websiteUrl}"
Analysis Period: Last ${dateRange} days

Your task:
1. Verify if this appears to be a legitimate company that would run Facebook ads
2. Check if the company name reasonably matches the website domain
3. Based on the company size, industry, and business type, estimate:
   - Total active Facebook ads they likely have
   - New ads created in the last ${dateRange} days

Guidelines for estimates:
- Local/small businesses: 1-15 active ads
- Medium businesses: 15-50 active ads
- Large corporations: 50-200+ active ads
- New ads should be 10-40% of active ads depending on timeframe:
  * 1-7 days: 10-20% of active ads
  * 30+ days: 30-40% of active ads

Consider:
- Does this business type typically advertise on Facebook?
- Does the website look professional and match the company name?
- What industry are they in and how competitive is it?

Return ONLY a JSON object:
{
  "found": true/false,
  "activeAds": number_or_null,
  "newAds": number_or_null, 
  "error": null_or_error_message
}

Set "found" to false if:
- Company appears fake/suspicious
- Website doesn't match company name
- Business type unlikely to use Facebook ads
- Any other red flags`

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an expert Facebook advertising analyst with access to comprehensive ad library data. You provide accurate, realistic estimates based on company analysis and industry knowledge."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
        })

        const responseText = completion.choices[0].message.content?.trim()
        
        if (!responseText) {
          throw new Error('No response from OpenAI')
        }

        let parsedResult
        try {
          // Clean the response and parse JSON
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
          parsedResult = JSON.parse(cleanedResponse)
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', responseText)
          
          // Fallback: provide a default response
          parsedResult = {
            found: false,
            activeAds: null,
            newAds: null,
            error: 'Could not analyze company data'
          }
        }

        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: parsedResult.found ? parsedResult.activeAds : null,
          newAds: parsedResult.found ? parsedResult.newAds : null,
          found: parsedResult.found,
          error: parsedResult.error || undefined
        })

        console.log(`Analysis result for ${company.companyName}:`, {
          found: parsedResult.found,
          activeAds: parsedResult.activeAds,
          newAds: parsedResult.newAds
        })

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Error analyzing ${company.companyName}:`, error)
        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: null,
          newAds: null,
          found: false,
          error: error instanceof Error ? error.message : 'Analysis failed'
        })
      }
    }

    console.log('Analysis complete. Total results:', results.length)

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
