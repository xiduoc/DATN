const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: 3001,
    DB: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'data'
    },
    LOCATION_UPDATE_INTERVAL: 60000, // 1 minute
    DEFAULT_DATE_RANGE: {
        start: '2000-01-01',
        end: '2100-01-01'
    },
    SAFE_RANGES: {
        humidity: { 
            min: 40, 
            max: 80, 
            unit: '%', 
            name: 'Humidity',
            recommendation: 'Adjust irrigation or ventilation to maintain optimal humidity levels.'
        },
        temperature: { 
            min: 20, 
            max: 30, 
            unit: '°C', 
            name: 'Temperature',
            recommendation: 'Consider shading or ventilation to maintain optimal temperature.'
        },
        conductivity: { 
            min: 0, 
            max: 2000, 
            unit: 'µS/cm', 
            name: 'Conductivity',
            recommendation: 'Check soil salinity and adjust fertilization accordingly.'
        },
        ph: { 
            min: 6.0, 
            max: 7.5, 
            unit: '', 
            name: 'pH',
            recommendation: 'Add appropriate amendments to adjust soil pH to optimal range.'
        },
        nitrogen: { 
            min: 150, 
            max: 300, 
            unit: 'mg/kg', 
            name: 'Nitrogen',
            recommendation: 'Adjust nitrogen fertilization based on crop requirements.'
        },
        phosphorus: { 
            min: 25, 
            max: 50, 
            unit: 'mg/kg', 
            name: 'Phosphorus',
            recommendation: 'Consider phosphorus fertilization if levels are low.'
        },
        potassium: { 
            min: 150, 
            max: 300, 
            unit: 'mg/kg', 
            name: 'Potassium',
            recommendation: 'Apply potassium fertilizer if levels are below optimal range.'
        }
    }
};

export default config;
