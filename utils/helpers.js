const fetch = require('node-fetch');
const config = require('../config/config');

// Location cache
const locationCache = new Map();

// Check parameter warnings
function checkWarning(parameter, value) {
    const range = config.SAFE_RANGES[parameter];
    if (!range || !value || isNaN(value)) return null;
    
    if (value < range.min || value > range.max) {
        return {
            parameter: range.name,
            value: value,
            unit: range.unit,
            safeRange: `${range.min} - ${range.max}`,
            recommendation: range.recommendation
        };
    }
    return null;
}

// Get location name from coordinates
async function getLocationName(latitude, longitude) {
    const cacheKey = `${latitude},${longitude}`;
    
    if (locationCache.has(cacheKey)) {
        return locationCache.get(cacheKey);
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: { 'User-Agent': 'SensorDataApp/1.0' },
                timeout: 5000
            }
        );
        
        if (!response.ok) throw new Error('Location API request failed');
        
        const data = await response.json();
        const locationName = formatLocationName(data);
        
        locationCache.set(cacheKey, locationName);
        return locationName;
    } catch (error) {
        console.error('Location fetch error:', error);
        return 'Unknown Location';
    }
}

// Format location name from API response
function formatLocationName(data) {
    if (!data.address) return 'Unknown Location';
    
    const parts = [
        data.address.road,
        data.address.suburb,
        data.address.city || data.address.town,
        data.address.state
    ].filter(Boolean);
    
    return parts.join(', ') || data.display_name || 'Unknown Location';
}

// Update locations in database
async function updateLocations(query) {
    try {
        const results = await query(
            'SELECT id, latitude, longitude FROM readnpk WHERE location IS NULL OR location = ""'
        );

        for (const row of results) {
            if (row.latitude && row.longitude) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
                const locationName = await getLocationName(row.latitude, row.longitude);
                
                await query('UPDATE readnpk SET location = ? WHERE id = ?', [locationName, row.id])
                    .catch(err => console.error(`Location update failed for ID ${row.id}:`, err));
            }
        }
    } catch (error) {
        console.error('Location update error:', error);
    }
}

module.exports = {
    checkWarning,
    getLocationName,
    formatLocationName,
    updateLocations
};
