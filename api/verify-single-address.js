// api/verify-single-address.js
// Vercel Serverless Function (Node.js)

// --- 1. CONFIGURATION AND UTILITIES ---
const INDIA_POST_API = 'https://api.postalpincode.in/pincode/';
let pincodeCache = {}; 
// Note: In a real Vercel setup, the API key would be stored in environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;


// Simplified set of words to strip from raw address before sending to LLM, 
// if they are clearly placeholder/meaningless.
const coreMeaningfulWords = [
    "ddadu", "ai", "add", "raw", "dumping", "grand", "chd", "chandigarh", "west", "sector", 
    "house", "no", "no#", "floor", "first", "majra", "colony", "dadu", "shop", "wine", 
    "number", "tq", "job", "dist"
];

const meaninglessRegex = new RegExp(`\\b(?:${coreMeaningfulWords.join('|')})\\b`, 'gi');
const directionalKeywords = ['near', 'opposite', 'back side', 'front side', 'behind', 'opp']; 


async function getIndiaPostData(pin) {
    if (pincodeCache[pin]) return pincodeCache[pin];

    try {
        const response = await fetch(`${INDIA_POST_API}${pin}`);
        const data = await response.json();

        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice) {
            pincodeCache[pin] = data[0].PostOffice;
            return data[0].PostOffice;
        }
        return [];
    } catch (error) {
        console.error("India Post API Error:", error);
        return [];
    }
}

/**
 * Executes a robust fetch with exponential backoff.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - Fetch options.
 * @returns {Promise<Object>} JSON response body.
 */
async function fetchWithRetry(url, options) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error?.message || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error(`Fetch attempt ${attempt + 1} failed: ${error.message}`);
            if (attempt === 2) throw error; 
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// --- 2. MAIN HANDLER ---

module.exports = async (req, res) => {
    // Enable CORS for Vercel functions (needed for cross-origin requests from the static site)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ status: "Error", error: "Method Not Allowed" });
    }

    try {
        // customerName is accepted here but is ignored for cleaning, only kept for bulk consistency.
        const { rawAddress, customerName } = req.body; 

        if (!rawAddress || typeof rawAddress !== 'string' || rawAddress.trim() === '') {
            return res.status(400).json({ status: "Error", error: "Missing or invalid 'rawAddress' in request body." });
        }

        const address = rawAddress.trim();
        let remarks = [];
        let primaryPostOffice = {};
        let initialPin = null;

        // 1. Initial Pincode Extraction and India Post Verification
        const pinMatch = address.match(/(\d{6})/);
        if (pinMatch) {
            initialPin = pinMatch[1];
            const postOffices = await getIndiaPostData(initialPin);
            if (postOffices.length > 0) {
                primaryPostOffice = postOffices[0];
                remarks.push(`Pincode ${initialPin} verified by India Post.`);
            } else {
                remarks.push(`Warning: Pincode ${initialPin} found but could not be verified by India Post.`);
            }
        } else {
            remarks.push(`Warning: No Pincode found in the raw address.`);
        }

        // 2. Prepare System Prompt and User Query for Address Cleaning
        
        const systemPrompt = `You are a world-class address cleaning and normalization engine. Your task is to process a messy, raw address string and return a standardized, structured JSON object. 
        1. **Do not perform name cleaning.** Ignore the customer name part of the request.
        2. **Clean Address (FormattedAddress):** This must be the most precise, single line address (e.g., House No, Street, Locality). Do not include city/district/state/PIN here.
        3. **Landmark:** Extract the most specific nearby feature (e.g., 'Near XYZ Bank', 'Opposite Market').
        4. **Geographic:** Extract the district, state, and pin code. If a pin code is clearly invalid, use 'Unknown' or 'N/A'.
        5. **Remarks:** Assess the quality of the raw address. If you made significant corrections, mention them here (e.g., 'Address was significantly corrected', 'Landmark inferred').
        6. **Adhere Strictly to the JSON schema.** Do not add any extra text or commentary outside the JSON object.`;
        
        const userQuery = `Raw Address: ${address}`;
        
        const schema = {
            type: "OBJECT",
            properties: {
                "FormattedAddress": { "type": "STRING", "description": "The cleaned, single-line address without city/district/state/PIN." },
                "Landmark": { "type": "STRING", "description": "The most precise landmark or directional cue." },
                "DIST.": { "type": "STRING", "description": "The District Name." },
                "State": { "type": "STRING", "description": "The State Name." },
                "PIN": { "type": "STRING", "description": "The 6-digit Pincode." },
                "AddressQuality": { "type": "STRING", "description": "A quality rating: High, Medium, or Low." },
                "Remarks": { "type": "STRING", "description": "Notes on corrections or data quality." },
            },
            required: ["FormattedAddress", "Landmark", "DIST.", "State", "PIN", "AddressQuality", "Remarks"],
            propertyOrdering: ["FormattedAddress", "Landmark", "DIST.", "State", "PIN", "AddressQuality", "Remarks"]
        };

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema
            },
        };

        // 3. Call the LLM API
        const apiResponse = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const jsonText = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            throw new Error("AI response was missing expected JSON content.");
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON:", jsonText);
            throw new Error("AI returned malformed JSON response.");
        }

        // 4. Final Data Assembly and Overrides

        // **Cleaned Name is always N/A or empty as we removed the feature**
        const cleanedName = ''; 
        
        // Final PIN logic: Prioritize India Post verified PIN, then LLM's PIN
        let finalPin = initialPin && primaryPostOffice.Name ? initialPin : (parsedData.PIN || 'N/A');

        // Final Landmark Logic
        let finalLandmark = parsedData.Landmark || '';
        if (!finalLandmark && initialPin && primaryPostOffice.Name) {
            // If LLM failed to find a landmark but we have a Post Office, use that as a fall-back landmark
            finalLandmark = `Near ${primaryPostOffice.Name} Post Office`;
            remarks.push('Landmark defaulted to primary Post Office location.');
        }

        // Aggregate LLM remarks
        if (parsedData.Remarks && parsedData.Remarks.trim()) {
            remarks.push(`AI Comment: ${parsedData.Remarks.trim()}`);
        } else {
            remarks.push('AI Comment: Address formatted successfully.');
        }


        // 5. Construct the Final JSON Response (Note: customerCleanName is empty)
        const finalResponse = {
            status: "Success",
            customerRawName: customerName || '', // Keep raw name if passed (for bulk), otherwise empty
            customerCleanName: cleanedName, // Always empty now
            
            // Core Address Components
            // Fallback to the LLM's formatted address, stripped of meaningless words if LLM failed.
            addressLine1: parsedData.FormattedAddress || address.replace(meaninglessRegex, '').trim() || '',
            landmark: finalLandmark, 
            
            // Geographic Components (Prioritize India Post verification if available)
            postOffice: primaryPostOffice.Name || parsedData['P.O.'] || '',
            tehsil: primaryPostOffice.Taluk || parsedData.Tehsil || '',
            district: primaryPostOffice.District || parsedData['DIST.'] || '',
            state: primaryPostOffice.State || parsedData.State || '',
            pin: finalPin, 

            // Quality/Verification Metrics
            addressQuality: parsedData.AddressQuality || 'Medium',
            locationType: parsedData.LocationType || 'Unknown',
            locationSuitability: parsedData.LocationSuitability || 'Unknown',
            
            // Remarks
            remarks: remarks.join('; ').trim(), // Send as a single string
        };

        return res.status(200).json(finalResponse);

    } catch (e) {
        console.error("Internal Server Error:", e);
        return res.status(500).json({ status: "Error", error: `Internal Server Error: ${e.message}` });
    }
};
