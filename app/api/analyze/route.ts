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
        console.log(`Processing company: ${company.companyName}`)
        
        // Use OpenAI to simulate the agent behavior you tested
        const prompt = `You are an AI agent that has access to Facebook Ads Library data. Based on your knowledge and reasoning, analyze the following company:

Company Name: "${company.companyName}"
Website URL: "${company.websiteUrl}"
Date Range: Last ${dateRange} days

Task:
1. Determine if this is a real company that likely runs Facebook ads
2. Based on the company size, industry, and typical advertising patterns, estimate:
   - Total active ads they might have
   - New ads created in the last ${dateRange} days
3. Verify the company name matches the website domain

Consider factors like:
- Company size and industry
- Typical advertising volumes for similar companies  
- Website domain matching company name
- Whether this type of business typically uses Facebook ads

Return ONLY a JSON object in this format:
{
  "found": true/false,
  "activeAds": estimated_number_or_null,
  "newAds": estimated_number_or_null,
  "error": null_or_error_message
}

Be realistic with numbers:
- Small local businesses: 1-10 active ads
- Medium businesses: 10-50 active ads  
- Large companies: 50+ active ads
- New ads should be 10-30% of active ads for the given timeframe`

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an AI assistant with deep knowledge of Facebook advertising patterns and business analysis. You can estimate advertising activity based on company information."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
        })

        const responseText = completion.choices[0].message.content?.trim()
        
        if (!responseText) {
          throw new Error('No response from OpenAI')
        }

        let parsedResult
        try {
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
          parsedResult = JSON.parse(cleanedResponse)
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', responseText)
          throw new Error('Invalid response format from AI')
        }

        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: parsedResult.found ? parsedResult.activeAds : null,
          newAds: parsedResult.found ? parsedResult.newAds : null,
          found: parsedResult.found,
          error: parsedResult.error || undefined
        })

        console.log(`Result for ${company.companyName}:`, parsedResult)

        // Small delay between requests
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
