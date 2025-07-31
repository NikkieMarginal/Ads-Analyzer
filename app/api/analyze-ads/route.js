import OpenAI from 'openai';

export async function POST(request) {
  try {
    const { apiKey, companies, dateRange } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'OpenAI API key is required' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const results = [];

    for (const company of companies) {
      try {
        // Create the analysis prompt for all platforms
        const prompt = `You are a web scraping and social media ads analysis agent. Your task is to analyze ad presence across multiple platforms for a given website.

Website URL: ${company.url}
Company Name: ${company.name || 'Not provided'}
Date Range: Last ${dateRange} days from today

Please analyze the following advertising platforms and return data in this exact JSON format:

{
  "companyName": "${company.name || ''}",
  "websiteUrl": "${company.url}",
  "verified": boolean (true if company name matches what you find, false otherwise),
  "platforms": {
    "facebook": {
      "found": boolean,
      "activeAds": number,
      "newAds": number (ads created in last ${dateRange} days)
    },
    "instagram": {
      "found": boolean, 
      "activeAds": number,
      "newAds": number
    },
    "bing": {
      "found": boolean,
      "activeAds": number, 
      "newAds": number
    },
    "tiktok": {
      "found": boolean,
      "activeAds": number,
      "newAds": number
    }
  }
}

Instructions:
1. Search Facebook Ads Library for ads associated with the website URL "${company.url}"
2. Search Instagram Ads Library for ads associated with the website URL "${company.url}"  
3. Search Bing Ads Intelligence for ads associated with the website URL "${company.url}"
4. Search TikTok Ads Library for ads associated with the website URL "${company.url}"
5. For each platform, count total active ads and new ads created in the last ${dateRange} days
6. If company name is provided, verify it matches what you find on each platform
7. Return only the JSON object, no additional text

Website to analyze: ${company.url}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an expert web scraper and social media ads analyst. You have access to browse the web and can search advertising libraries across multiple platforms. Always return valid JSON responses only."
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        });

        const responseText = completion.choices[0].message.content.trim();
        
        // Try to parse the JSON response
        let analysisResult;
        try {
          analysisResult = JSON.parse(responseText);
        } catch (parseError) {
          // If parsing fails, create a default structure
          analysisResult = {
            companyName: company.name || '',
            websiteUrl: company.url,
            verified: false,
            platforms: {
              facebook: { found: false, activeAds: 0, newAds: 0 },
              instagram: { found: false, activeAds: 0, newAds: 0 },
              bing: { found: false, activeAds: 0, newAds: 0 },
              tiktok: { found: false, activeAds: 0, newAds: 0 }
            }
          };
        }

        results.push(analysisResult);

      } catch (error) {
        console.error(`Error analyzing ${company.url}:`, error);
        
        // Add error result for this company
        results.push({
          companyName: company.name || '',
          websiteUrl: company.url,
          verified: false,
          platforms: {
            facebook: { found: false, activeAds: 0, newAds: 0 },
            instagram: { found: false, activeAds: 0, newAds: 0 },
            bing: { found: false, activeAds: 0, newAds: 0 },
            tiktok: { found: false, activeAds: 0, newAds: 0 }
          },
          error: 'Analysis failed'
        });
      }
    }

    return Response.json({
      companies: results,
      dateRange: dateRange,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: 'Failed to analyze ads: ' + error.message }, 
      { status: 500 }
    );
  }
}
