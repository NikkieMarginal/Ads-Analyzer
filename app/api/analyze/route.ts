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

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const results: CompanyResult[] = []

    for (const company of companies as CompanyInput[]) {
      try {
        const prompt = `
You are an AI agent that needs to analyze Facebook Ads Library data. Please perform the following task:

1. Go to Facebook Ads Library (https://www.facebook.com/ads/library/)
2. Search for the company: "${company.companyName}"
3. Verify this is the correct company by checking if their website URL "${company.websiteUrl}" is associated with their ads or business information
4. Count the total number of ACTIVE ads for this company
5. Count the number of NEW ads created within the last ${dateRange} days (from today backwards)
6. If the company is not found or the website URL doesn't match, return that information

Please return the data in this exact JSON format:
{
  "found": true/false,
  "activeAds": number or null,
  "newAds": number or null,
  "error": "error message if any"
}

Company: ${company.companyName}
Website: ${company.websiteUrl}
Date range: Last ${dateRange} days

Important: Only return the JSON object, no additional text.
        `

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant that can browse the web and extract data from Facebook Ads Library. Always return responses in the exact JSON format requested."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
        })

        const responseText = completion.choices[0].message.content?.trim()
        
        if (!responseText) {
          throw new Error('No response from OpenAI')
        }

        // Try to parse the JSON response
        let parsedResult
        try {
          // Remove any markdown formatting if present
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
          error: parsedResult.error
        })

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Error analyzing ${company.companyName}:`, error)
        results.push({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          activeAds: null,
          newAds: null,
          found: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }

    return NextResponse.json({
      companies: results,
      dateRange,
      analysisDate: new Date().toISOString().split('T')[0]
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
