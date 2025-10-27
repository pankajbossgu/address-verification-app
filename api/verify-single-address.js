// api/verify-single-address.js
// Vercel Serverless Function (Node.js)

// --- 1. CONFIGURATION AND UTILITIES ---
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini Client using environment variable GEMINI_API_KEY
// Vercel automatically loads process.env variables configured in the dashboard.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

const INDIA_POST_API = 'https://api.postalpincode.in/pincode/';
let pincodeCache = {}; 

// List of meaningless words to strip from the 'Remaining' field (moved to config for clarity)
const meaninglessWords = [
    "ddadu", "ai", "add", "add-", "raw", "dumping", "grand", "chd", "chd-", "chandigarh", 
    "west", "sector", "sector-", "house", "no", "no#", "floor", "first", "majra", "colony", 
    "dadu", "shop", "wine", "number", "tq", "job", "dist"
].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape regex special chars
const meaninglessRegex = new RegExp(`\\b(?:${meaninglessWords.join('|')})\\b`, 'gi');
const MODEL_NAME = "gemini-2.5-flash"; // Use the latest, highly capable, and fast model

/**
 * Fetches and caches Post Office data from the India Post API.
 * @param {string} pin - The 6-digit PIN code.
 * @returns {Promise<{PinStatus: string, PostOfficeList?: object[]}>}
 */
async function getIndiaPostData(pin) {
    if (pincodeCache[pin]) return pincodeCache[pin];
    if (!pin || pin.length !== 6 || isNaN(pin)) {
         return { PinStatus: 'Error' };
    }

    try {
        const response = await fetch(INDIA_POST_API + pin);
        const data = await response.json();
        const postData = data[0];

        if (response.status !== 200 || postData?.Status !== 'Success' || !postData.PostOffice) {
            pincodeCache[pin] = { PinStatus: 'Error' };
            return pincodeCache[pin];
        }

        const postOffices = postData.PostOffice.map(po => ({
            Name: po.Name || '',
            Taluk: po.Taluk || po.SubDistrict || '',
            District: po.District || '',
            State: po.State || ''
        }));

        const result = {
            PinStatus: 'Success',
            PostOfficeList: postOffices,
        };
        pincodeCache[pin] = result;
        return result;
    } catch (e) {
        console.error(`India Post API Error for ${pin}:`, e.message);
        pincodeCache[pin] = { PinStatus: 'Error' };
        return pincodeCache[pin];
    }
}

/**
 * Calls the Gemini API using the official SDK.
 * @param {string} prompt - The prompt to send to the model.
 * @returns {Promise<{text: string|null, error: string|null}>}
 */
async function getGeminiResponse(prompt) {
    if (!process.env.GEMINI_API_KEY) {
        return { text: null, error: "Gemini API key is not set in Vercel environment variables." };
    }

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                 // Enforce JSON output for reliability
                responseMimeType: "application/json", 
            }
        });
        
        // The SDK automatically parses the JSON text from the response
        const text = response.text.trim();
        
        if (!text) {
             const errorMessage = "Gemini API Error: Received empty response text.";
             console.error(errorMessage);
             return { text: null, error: errorMessage };
        }

        return { text: text, error: null };
    } catch (e) {
        const errorMessage = `Gemini SDK Error: ${e.message}`;
        console.error(errorMessage);
        return { text: null, error: errorMessage };
    }
}

/**
 * Extracts a 6-digit PIN code from a string.
 * @param {string} address 
 * @returns {string|null}
 */
function extractPin(address) {
    const match = String(address).match(/\b\d{6}\b/);
    return match ? match[0] : null;
}

/**
 * Builds a structured prompt for the Gemini model.
 * @param {string} originalAddress 
 * @param {object} postalData 
 * @returns {string}
 */
function buildGeminiPrompt(originalAddress, postalData) {
    let basePrompt = `You are an expert Indian address verifier and formatter. Your task is to process the RAW ADDRESS provided and clean, standardize, and structure the data.

**Instructions:**
1. **Clean and Correct:** Correct all common spelling/phonetic errors (e.g., 'rd' to 'Road', 'nager' to 'Nagar'). Identify and remove any duplicate consecutive components (e.g., 'Street Street').
2. **Translate:** Strictly translate all extracted address components to English.
3. **Use Postal Data:** Use the provided Official Postal Data (if available) to verify/fill the 'P.O.', 'Tehsil', 'DIST.', and 'State' fields.
4. **PIN Check:** If the PIN in the raw address is invalid or missing, use your geographic knowledge to suggest the most likely correct 6-digit PIN.

**RAW ADDRESS:** "${originalAddress}"
`;

    if (postalData.PinStatus === 'Success' && postalData.PostOfficeList.length > 0) {
        basePrompt += `\n**Official Postal Data (Use for verification):** ${JSON.stringify(postalData.PostOfficeList[0])}\n`;
    } else {
        basePrompt += `\n**Postal Data Status:** Invalid/Missing PIN. Use your best judgment to find and verify the correct PIN.`;
    }
    
    // Define the strict JSON schema
    basePrompt += `\n\n**Output Format (STRICT JSON OBJECT):**
Provide the response as a single, valid JSON object with the following keys. Do not add any text outside the JSON block.

{
  "H.no.": "Extract number/alphanumeric for House/Flat/Plot (e.g., '1-26', 'A/25'). Set to null if not found.",
  "Colony": "Extracted Colony/Street/Locality/Building Name.",
  "P.O.": "The official Post Office name (e.g., 'Boduppal').",
  "Tehsil": "The official Tehsil/SubDistrict name (e.g., 'Pune').",
  "DIST.": "The official District name.",
  "State": "The official State name.",
  "PIN": "The final verified 6-digit PIN code (as a string).",
  "Landmark": "A specific, named landmark (e.g., 'Apollo Hospital'), extracted WITHOUT directional words (near/opp). Comma-separated if multiple.",
  "Remaining": "Any remaining, non-address related text. Clean this by removing meaningless words like 'job', 'raw', 'add-' and known geographic details.",
  "FormattedAddress": "The single, clean, shipping-ready address line (H.no. + Colony + P.O. + Tehsil + District). DO NOT include State or PIN. Use commas.",
  "LocationType": "Village, Town, City, or Urban Area.",
  "AddressQuality": "Very Good, Good, Medium, Bad, or Very Bad.",
  "LocationSuitability": "Prime Location, Tier 1 & 2 Cities, Remote/Difficult Location, or Non-Serviceable Location."
}`;

    return basePrompt;
}


// --- 2. MAIN HANDLER ---

module.exports = async (req, res) => {
    // START OF CORS FIX (Professional: Centralize all necessary headers)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Be professional: use environment variable for CORS origin if possible, otherwise keep the domain
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'https://pankajbossgu.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: "Error", error: 'Method Not Allowed' });
    }
    // END OF CORS FIX

    try {
        const { address, customerName } = req.body;
        
        if (!address) {
            return res.status(400).json({ status: "Error", error: "Address is required." });
        }

        const cleanedName = customerName ? customerName.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim() : null;
        const initialPin = extractPin(address);
        let postalData = { PinStatus: 'Error', PostOfficeList: [] };
        
        if (initialPin) {
            postalData = await getIndiaPostData(initialPin);
        }

        // 1. Call Gemini API
        const geminiResult = await getGeminiResponse(buildGeminiPrompt(address, postalData));
        if (geminiResult.error || !geminiResult.text) {
            return res.status(500).json({ status: "Error", error: geminiResult.error || "Gemini API failed to return text." });
        }

        // 2. Parse Gemini JSON output
        let parsedData;
        try {
            // JSON parsing is cleaner now that we enforce JSON output from the model
            parsedData = JSON.parse(geminiResult.text);
        } catch (e) {
            console.error("JSON Parsing Error:", e.message, "Raw Output:", geminiResult.text);
            return res.status(500).json({ status: "Error", error: "Failed to parse Gemini output as JSON. Raw output logged.", rawOutput: geminiResult.text });
        }

        // 3. Final cleanup and geographic verification
        const geminiSuggestedPin = extractPin(String(parsedData.PIN || ''));
        let finalPin = initialPin || geminiSuggestedPin;

        // Re-run India Post lookup if Gemini suggested a new, valid PIN
        if (geminiSuggestedPin && geminiSuggestedPin !== initialPin) {
            const finalPostalData = await getIndiaPostData(geminiSuggestedPin);
            if (finalPostalData.PinStatus === 'Success') {
                postalData = finalPostalData;
                finalPin = geminiSuggestedPin;
            }
        }
        
        // Select the most reliable Post Office data
        const primaryPostOffice = postalData.PostOfficeList ? postalData.PostOfficeList[0] : {};

        // 4. Construct the Final JSON Response
        const finalResponse = {
            status: "Success",
            customerRawName: customerName,
            customerCleanName: cleanedName,
            
            // Core Address Components (Prioritize Gemini's cleaned data)
            addressLine1: parsedData.FormattedAddress || address.replace(meaninglessRegex, '').trim() || '',
            landmark: parsedData.Landmark || '',
            
            // Geographic Components (Prioritize India Post)
            postOffice: primaryPostOffice.Name || parsedData['P.O.'] || '',
            tehsil: primaryPostOffice.Taluk || parsedData.Tehsil || '',
            district: primaryPostOffice.District || parsedData['DIST.'] || '',
            state: primaryPostOffice.State || parsedData.State || '',
            pin: finalPin || parsedData.PIN || null,

            // Quality/Verification Metrics (From Gemini)
            addressQuality: parsedData.AddressQuality || 'Medium',
            locationType: parsedData.LocationType || 'Unknown',
            locationSuitability: parsedData.LocationSuitability || 'Unknown',
            
            // Remarks (Cleaned up the Remaining field)
            remarks: (parsedData.Remaining || 'Address verified and formatted successfully.').replace(meaninglessRegex, '').trim(),
        };

        return res.status(200).json(finalResponse);

    } catch (e) {
        console.error("Internal Server Error:", e);
        // Ensure a consistent error structure for the frontend
        return res.status(500).json({ 
            status: "Error", 
            error: `Internal Server Error: ${e.message}`,
            remarks: `An unexpected server error occurred: ${e.message}`
        });
    }
};
