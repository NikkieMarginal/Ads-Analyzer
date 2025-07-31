import './globals.css'

export const metadata = {
  title: 'Multi-Platform Ads Analyzer',
  description: 'Analyze competitor ads across Facebook, Instagram, Bing, and TikTok',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
