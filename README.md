# Multi-Platform Ads Library Analyzer

A comprehensive Next.js application that analyzes competitor advertising activity across Facebook, Instagram, Bing, and TikTok using OpenAI's agent capabilities.

## Features

- 🔍 **Multi-Platform Analysis**: Analyze ads across Facebook, Instagram, Bing, and TikTok
- 🤖 **AI-Powered**: Uses OpenAI agents for intelligent web scraping and data extraction
- 📊 **Comprehensive Reporting**: Active ads and new ads tracking with customizable date ranges
- 📈 **Data Export**: Export results to CSV for further analysis
- 🎨 **Modern UI**: Clean, responsive interface with platform-specific theming
- ⚡ **Fast Deployment**: Optimized for Vercel deployment

## Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd multi-platform-ads-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Enter OpenAI API Key**: Input your OpenAI API key in the configuration form
2. **Add Companies**: Enter up to 3 website URLs (company names optional for verification)
3. **Select Date Range**: Choose from 1, 3, 7, 30, or 90 days for new ads analysis
4. **Analyze**: Click "Analyze All Platforms" to start the analysis
5. **View Results**: See platform-specific results with active and new ad counts
6. **Export Data**: Download results as CSV for further analysis

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Add your OpenAI API key as an environment variable in Vercel dashboard
4. Deploy!

### Manual Deployment

```bash
npm run build
npm start
```

## Platform Coverage

- **Facebook Ads Library**: Comprehensive Facebook advertising data
- **Instagram Ads Library**: Instagram-specific ad campaigns  
- **Bing Ads Intelligence**: Microsoft Advertising platform data
- **TikTok Ads Library**: TikTok advertising transparency data

## API Reference

### POST /api/analyze-ads

Analyzes ads across all platforms for given companies.

**Request Body:**
```json
{
  "apiKey": "your_openai_api_key",
  "companies": [
    {
      "name": "Company Name (optional)",
      "url": "https://example.com"
    }
  ],
  "dateRange": 7
}
```

**Response:**
```json
{
  "companies": [
    {
      "companyName": "Company Name",
      "websiteUrl": "https://example.com", 
      "verified": true,
      "platforms": {
        "facebook": {
          "found": true,
          "activeAds": 25,
          "newAds": 5
        },
        "instagram": {
          "found": true, 
          "activeAds": 18,
          "newAds": 3
        },
        "bing": {
          "found": false,
          "activeAds": 0,
          "newAds": 0
        },
        "tiktok": {
          "found": true,
          "activeAds": 12,
          "newAds": 2
        }
      }
    }
  ],
  "dateRange": 7,
  "analyzedAt": "2024-01-15T10:30:00.000Z"
}
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `NEXT_PUBLIC_APP_URL`: Your app URL for production (optional)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email your-email@example.com or create an issue in this repository.

---

Built with ❤️ using Next.js, OpenAI, and Tailwind CSS
