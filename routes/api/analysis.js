import express from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { query } from '../../config/database.js';

const router = express.Router();

// Optimal ranges for different crops
const CROP_PARAMETERS = {
    'Lúa': {
        npk: { min_n: 80, max_n: 120, min_p: 30, max_p: 50, min_k: 60, max_k: 100 },
        ph: { min: 5.5, max: 6.5 },
        ratio: '3:1:2'
    },
    'Ngô': {
        npk: { min_n: 140, max_n: 200, min_p: 45, max_p: 80, min_k: 80, max_k: 120 },
        ph: { min: 6.0, max: 7.0 },
        ratio: '4:2:3'
    },
    'Rau xanh': {
        npk: { min_n: 100, max_n: 150, min_p: 40, max_p: 60, min_k: 100, max_k: 150 },
        ph: { min: 6.0, max: 6.8 },
        ratio: '2:1:2'
    },
    'Cà chua': {
        npk: { min_n: 120, max_n: 180, min_p: 50, max_p: 90, min_k: 120, max_k: 180 },
        ph: { min: 6.0, max: 6.8 },
        ratio: '3:2:3'
    },
    'Cà phê': {
        npk: { min_n: 150, max_n: 250, min_p: 40, max_p: 80, min_k: 150, max_k: 250 },
        ph: { min: 5.5, max: 6.5 },
        ratio: '4:1:4'
    },
    'Chè': {
        npk: { min_n: 200, max_n: 300, min_p: 50, max_p: 100, min_k: 100, max_k: 200 },
        ph: { min: 4.5, max: 5.5 },
        ratio: '4:1:2'
    }
};

// Default ranges for unknown crop types
const DEFAULT_RANGES = {
    npk: { min_n: 100, max_n: 200, min_p: 40, max_p: 80, min_k: 80, max_k: 160 },
    ph: { min: 6.0, max: 7.0 },
    ratio: '3:1:2'
};

// Helper function to calculate NPK ratio
function calculateNPKRatio(n, p, k) {
    const min = Math.min(n, p, k);
    if (min === 0) return null;
    
    return {
        ratio: `${Math.round((n/min)*10)/10}:${Math.round((p/min)*10)/10}:${Math.round((k/min)*10)/10}`,
        n: Math.round((n/min)*10)/10,
        p: Math.round((p/min)*10)/10,
        k: Math.round((k/min)*10)/10
    };
}

// Helper function to determine nutrient level based on crop parameters
function determineNutrientLevel(value, minValue, maxValue) {
    if (value < minValue) return 'low';
    if (value > maxValue) return 'high';
    return 'optimal';
}

// Helper function to calculate fertilizer recommendations
function calculateFertilizerAmount(current, min, max, area) {
    const target = (max + min) / 2;
    const deficit = Math.max(0, target - current);
    // Convert to kg/ha and adjust for area
    return Math.round((deficit * 2 * (area / 10000)) * 10) / 10;
}

// Helper function to generate recommendations based on analysis
function generateRecommendations(npkLevels, phLevel, currentRatio, cropParams, area) {
    const recommendations = [];
    const fertilizers = {};

    // pH recommendations
    if (phLevel < cropParams.ph.min) {
        const phDiff = cropParams.ph.min - phLevel;
        recommendations.push(`pH thấp (${phLevel.toFixed(1)}): Cần bổ sung ${Math.round(phDiff * 1000)} kg/ha vôi để tăng độ pH lên ${cropParams.ph.min}`);
    } else if (phLevel > cropParams.ph.max) {
        recommendations.push(`pH cao (${phLevel.toFixed(1)}): Cân nhắc sử dụng phân bón acid hoặc lưu huỳnh để giảm pH xuống ${cropParams.ph.max}`);
    }

    // NPK recommendations and calculations
    if (npkLevels.nitrogen === 'low') {
        const amount = calculateFertilizerAmount(npkLevels.n_value, cropParams.npk.min_n, cropParams.npk.max_n, area);
        fertilizers.n = amount;
        recommendations.push(`Nitrogen thấp: Bổ sung ${amount} kg phân đạm (N) cho ${area}m². Có thể dùng urê (46%N) hoặc NPK tỷ lệ cao đạm`);
    }
    if (npkLevels.phosphorus === 'low') {
        const amount = calculateFertilizerAmount(npkLevels.p_value, cropParams.npk.min_p, cropParams.npk.max_p, area);
        fertilizers.p = amount;
        recommendations.push(`Phosphorus thấp: Bổ sung ${amount} kg phân lân (P) cho ${area}m². Có thể dùng super phosphate (16%P) hoặc NPK tỷ lệ cao lân`);
    }
    if (npkLevels.potassium === 'low') {
        const amount = calculateFertilizerAmount(npkLevels.k_value, cropParams.npk.min_k, cropParams.npk.max_k, area);
        fertilizers.k = amount;
        recommendations.push(`Potassium thấp: Bổ sung ${amount} kg phân kali (K) cho ${area}m². Có thể dùng kali clorua (60%K) hoặc NPK tỷ lệ cao kali`);
    }

    // Balance recommendations
    const targetRatio = cropParams.ratio;
    if (currentRatio && targetRatio) {
        recommendations.push(`Tỷ lệ NPK hiện tại là ${currentRatio} (Mục tiêu: ${targetRatio})`);
        if (currentRatio !== targetRatio) {
            recommendations.push('Khuyến nghị điều chỉnh phân bón để đạt tỷ lệ NPK phù hợp với loại cây trồng');
        }
    }

    return {
        recommendations,
        fertilizers
    };
}

// Get NPK and pH analysis
router.get('/npk-ph', authenticateUser, async (req, res) => {
    try {
        const { location, days = 7 } = req.query;

        // Get growing area information for the location
        const areaInfo = await query(`
            SELECT name, crop_type, area 
            FROM growing_areas 
            WHERE location = ? AND user_id = ? AND status = 'active'
            LIMIT 1
        `, [location, req.user.id]);

        const cropType = areaInfo.length > 0 ? areaInfo[0].crop_type : null;
        const area = areaInfo.length > 0 ? areaInfo[0].area : 0;
        const cropParams = CROP_PARAMETERS[cropType] || DEFAULT_RANGES;

        // Get recent readings for the specified location with additional calculations
        const readings = await query(`
            SELECT
                AVG(nitrogen) as avg_nitrogen,
                AVG(phosphorus) as avg_phosphorus,
                AVG(potassium) as avg_potassium,
                AVG(ph) as avg_ph,
                MIN(nitrogen) as min_nitrogen,
                MIN(phosphorus) as min_phosphorus,
                MIN(potassium) as min_potassium,
                MIN(ph) as min_ph,
                MAX(nitrogen) as max_nitrogen,
                MAX(phosphorus) as max_phosphorus,
                MAX(potassium) as max_potassium,
                MAX(ph) as max_ph,
                COUNT(*) as reading_count,
                STDDEV(nitrogen) as std_nitrogen,
                STDDEV(phosphorus) as std_phosphorus,
                STDDEV(potassium) as std_potassium,
                STDDEV(ph) as std_ph
            FROM readnpk r
            LEFT JOIN devices d ON r.device_id = d.id
            WHERE (d.user_id = ? OR r.user_id = ?)
                ${location ? 'AND r.location = ?' : ''}
                AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [req.user.id, req.user.id, ...(location ? [location] : []), days]);

        if (!readings || readings.length === 0 || readings[0].reading_count === 0) {
            return res.status(404).json({ error: 'No data found for the specified criteria' });
        }

        const reading = readings[0];

        // Calculate NPK levels based on crop parameters
        const npkLevels = {
            nitrogen: determineNutrientLevel(reading.avg_nitrogen, cropParams.npk.min_n, cropParams.npk.max_n),
            phosphorus: determineNutrientLevel(reading.avg_phosphorus, cropParams.npk.min_p, cropParams.npk.max_p),
            potassium: determineNutrientLevel(reading.avg_potassium, cropParams.npk.min_k, cropParams.npk.max_k),
            n_value: reading.avg_nitrogen,
            p_value: reading.avg_phosphorus,
            k_value: reading.avg_potassium
        };

        // Calculate current NPK ratio
        const currentRatio = calculateNPKRatio(
            reading.avg_nitrogen,
            reading.avg_phosphorus,
            reading.avg_potassium
        );

        // Generate enhanced analysis with crop-specific information
        const analysis = {
            location: location || 'All locations',
            period: `${days} days`,
            readings: reading.reading_count,
            crop_info: cropType ? {
                type: cropType,
                area: area,
                optimal_ratio: cropParams.ratio
            } : null,
            current: {
                nitrogen: {
                    value: reading.avg_nitrogen,
                    level: npkLevels.nitrogen,
                    optimal_range: { min: cropParams.npk.min_n, max: cropParams.npk.max_n }
                },
                phosphorus: {
                    value: reading.avg_phosphorus,
                    level: npkLevels.phosphorus,
                    optimal_range: { min: cropParams.npk.min_p, max: cropParams.npk.max_p }
                },
                potassium: {
                    value: reading.avg_potassium,
                    level: npkLevels.potassium,
                    optimal_range: { min: cropParams.npk.min_k, max: cropParams.npk.max_k }
                },
                ph: {
                    value: reading.avg_ph,
                    level: determineNutrientLevel(reading.avg_ph, cropParams.ph.min, cropParams.ph.max),
                    optimal_range: cropParams.ph
                },
                npk_ratio: currentRatio ? currentRatio.ratio : null
            },
            statistics: {
                nitrogen: {
                    min: reading.min_nitrogen,
                    max: reading.max_nitrogen,
                    average: reading.avg_nitrogen,
                    std_dev: reading.std_nitrogen
                },
                phosphorus: {
                    min: reading.min_phosphorus,
                    max: reading.max_phosphorus,
                    average: reading.avg_phosphorus,
                    std_dev: reading.std_phosphorus
                },
                potassium: {
                    min: reading.min_potassium,
                    max: reading.max_potassium,
                    average: reading.avg_potassium,
                    std_dev: reading.std_potassium
                },
                ph: {
                    min: reading.min_ph,
                    max: reading.max_ph,
                    average: reading.avg_ph,
                    std_dev: reading.std_ph
                }
            }
        };

        // Generate recommendations and fertilizer calculations
        const { recommendations, fertilizers } = generateRecommendations(
            npkLevels,
            reading.avg_ph,
            currentRatio ? currentRatio.ratio : null,
            cropParams,
            area
        );

        analysis.recommendations = recommendations;
        analysis.fertilizer_calculations = fertilizers;

        res.json(analysis);
    } catch (error) {
        console.error('NPK/pH analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze NPK/pH data' });
    }
});

// Get historical NPK and pH trends
router.get('/npk-ph/trends', authenticateUser, async (req, res) => {
    try {
        const { location, interval = 'day', days = 30 } = req.query;

        // Get historical trends
        const trends = await query(`
            SELECT 
                CASE ?
                    WHEN 'hour' THEN DATE_FORMAT(r.created_at, '%Y-%m-%d %H:00')
                    WHEN 'day' THEN DATE_FORMAT(r.created_at, '%Y-%m-%d')
                    WHEN 'week' THEN DATE_FORMAT(r.created_at, '%Y-%u')
                    WHEN 'month' THEN DATE_FORMAT(r.created_at, '%Y-%m')
                    ELSE DATE_FORMAT(r.created_at, '%Y-%m-%d')
                END as period,
                AVG(r.nitrogen) as avg_nitrogen,
                AVG(r.phosphorus) as avg_phosphorus,
                AVG(r.potassium) as avg_potassium,
                AVG(r.ph) as avg_ph
            FROM readnpk r
            LEFT JOIN devices d ON r.device_id = d.id
            WHERE (d.user_id = ? OR r.user_id = ?)
                ${location ? 'AND r.location = ?' : ''}
                AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY period
            ORDER BY period DESC
        `, [interval, req.user.id, req.user.id, ...(location ? [location] : []), days]);

        res.json(trends);
    } catch (error) {
        console.error('NPK/pH trends error:', error);
        res.status(500).json({ error: 'Failed to fetch NPK/pH trends' });
    }
});

export default router;
