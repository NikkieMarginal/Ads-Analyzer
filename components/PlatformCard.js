import { CheckCircle, AlertCircle } from 'lucide-react';

export default function PlatformCard({ 
  platform, 
  data, 
  dateRange, 
  bgColor, 
  textColor, 
  iconBg, 
  icon 
}) {
  return (
    <div className={`border rounded-lg p-4 ${bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-lg font-semibold ${textColor} flex items-center`}>
          <div className={`w-6 h-6 ${iconBg} rounded mr-2 flex items-center justify-center text-white text-xs font-bold`}>
            {icon}
          </div>
          {platform} Ads Library
        </h4>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          data.found 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {data.found ? 'Found' : 'Not Found'}
        </span>
      </div>
      {data.found ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className={`text-2xl font-bold ${textColor.replace('text-', 'text-').replace('-900', '-600')}`}>
              {data.activeAds}
            </p>
            <p className={`text-sm ${textColor}`}>Active Ads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data.newAds}</p>
            <p className="text-sm text-green-700">New Ads ({dateRange}d)</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-600 text-center">No ads found on {platform}</p>
      )}
    </div>
  );
}
