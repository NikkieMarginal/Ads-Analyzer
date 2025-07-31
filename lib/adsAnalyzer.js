// Utility functions for ads analysis

export const platformConfigs = {
  facebook: {
    name: 'Facebook',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-900', 
    iconBg: 'bg-blue-600',
    icon: 'F'
  },
  instagram: {
    name: 'Instagram',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-900',
    iconBg: 'bg-pink-600', 
    icon: 'I'
  },
  bing: {
    name: 'Bing',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-900',
    iconBg: 'bg-orange-600',
    icon: 'B'
  },
  tiktok: {
    name: 'TikTok', 
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-900',
    iconBg: 'bg-black',
    icon: 'T'
  }
};

export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function formatAnalysisData(rawData) {
  return {
    ...rawData,
    analyzedAt: new Date().toISOString(),
    totalActiveAds: rawData.companies.reduce((sum, company) => 
      sum + Object.values(company.platforms).reduce((pSum, platform) => 
        pSum + (platform.found ? platform.activeAds : 0), 0
      ), 0
    ),
    totalNewAds: rawData.companies.reduce((sum, company) => 
      sum + Object.values(company.platforms).reduce((pSum, platform) => 
        pSum + (platform.found ? platform.newAds : 0), 0
      ), 0
    )
  };
}
