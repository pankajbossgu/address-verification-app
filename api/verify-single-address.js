// api/verify-single-address.js
// Vercel Serverless Function (Node.js)

// --- 1. CONFIGURATION AND UTILITIES ---
const INDIA_POST_API = 'https://api.postalpincode.in/pincode/';
let pincodeCache = {}; 

const testingKeywords = ['test', 'testing', 'asdf', 'qwer', 'zxcv', 'random', 'gjnj', 'fgjnj'];
const meaningfulWords = [
    "ddadu", "ddadu", "ai", "add", "add-", "raw", "dumping", "grand", "dumping grand",
    "chd", "chd-", "chandigarh", "chandigarh-", "chandigarh", "west", "sector", "sector-",
    "house", "no", "no#", "house no", "house no#", "floor", "first", "first floor",
    "majra", "colony", "dadu", "dadu majra", "shop", "wine", "wine shop", "house", "number",
    "tq", "job", "dist"
];
const meaninglessRegex = new RegExp(`\\b(?:${meaningfulWords.join('|')})\\b`, 'gi');
const directionalKeywords = ['near', 'opposite', 'back side', 'front side', 'behind', 'opp'];


async function getIndiaPostData(pin) {
    if (pincodeCache[pin]) return pincodeCache[pin];

    try {
        const response = await fetch(INDIA_POST_API + pin);
        const data = await response.json();
        const postData = data[0];

        if (response.status !== 200 || postData.Status !== 'Success') {
            pincodeCache[pin] = { PinStatus: 'Error' };
            return pincodeCache[pin];
        }

        const postOffices = postData.PostOffice.map(po => ({
            Name: po.Name || '',
            Taluk: po.Taluk || po.SubDistrict || '',
            District: po.District || '',
            State: po.State || ''
        }));

        pincodeCache[pin] = {
            PinStatus: 'Success',
            PostOfficeList: postOffices,
        };
        return pincodeCache[pin];
    } catch (e) {
        console.error("India Post API Error:", e.message);
        pincodeCache[pin] = { PinStatus: 'Error' };
        return pincodeCache[pin];
    }
}


async function getGeminiResponse(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { text: null, error: "Gemini API key not set in Vercel environment variables." };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    };

    try {
        const response = await fetch(apiUrl, options);
        const result = await response.json();

        if (response.status !== 200) {
            const errorMessage = `Gemini API Error: ${result.error?.message || "Unknown error."}`;
            console.error(errorMessage);
            return { text: null, error: errorMessage };
        }

        if (result.candidates && result.candidates.length > 0) {
            return { text: result.candidates[0].content.parts[0].text, error: null };
        } else {
            const errorMessage = "Gemini API Error: No candidates found in response.";
            console.error(errorMessage);
            return { text: null, error: errorMessage };
        }
    } catch (e) {
        const errorMessage = `Error during Gemini API call: ${e.message}`;
        console.error(errorMessage);
        return { text: null, error: errorMessage };
    }
}

function extractPin(address) {
    const match = String(address).match(/\b\d{6}\b/);
    return match ? match[0] : null;
}

function buildGeminiPrompt(originalAddress, postalData) {
    let basePrompt = `You are an expert Indian address verifier and formatter. Your task is to process a raw address, perform a thorough analysis, and provide a comprehensive response in a single JSON object. Provide all responses in English only. Strictly translate all extracted address components to English. Correct all common spelling and phonetic errors in the provided address, such as "rd" to "Road", "nager" to "Nagar", and "nd" to "2nd". Analyze common short forms and phonetic spellings, such as "lean" for "Lane", and use your best judgment to correct them. Be strict about ensuring the output is a valid, single, and complete address for shipping. Use your advanced knowledge to identify and remove any duplicate address components that are present consecutively (e.g., 'Gandhi Street Gandhi Street' should be 'Gandhi Street').

Your response must contain the following keys:
1.  "H.no.", "Flat No.", "Plot No.", "Room No.", "Building No.", "Block No.", "Ward No.", "Gali No.", "Zone No.": Extract only the number or alphanumeric sequence (e.g., '1-26', 'A/25', '10'). Set to null if not found.
2.  "Colony", "Street", "Locality", "Building Name", "House Name", "Floor": Extract the name.
3.  "P.O.": The official Post Office name from the PIN data. Prepend "P.O." to the name. Example: "P.O. Boduppal".
4.  "Tehsil": The official Tehsil/SubDistrict from the PIN data. Prepend "Tehsil". Example: "Tehsil Pune".
5.  "DIST.": The official District from the PIN data.
6.  "State": The official State from the PIN data.
7.  "PIN": The 6-digit PIN code. Find and verify the correct PIN. If a PIN exists in the raw address but is incorrect, find the correct one and provide it.
8.  "Landmark": A specific, named landmark (e.g., "Apollo Hospital"), not a generic type like "school". If multiple landmarks are present, list them comma-separated. Extract the landmark without any directional words like 'near', 'opposite', 'behind' etc., as this will be handled by the script.
9.  "Remaining": A last resort for any text that does not fit into other fields. Clean this by removing meaningless words like 'job', 'raw', 'add-', 'tq', 'dist' and country, state, district, or PIN code.
10. "FormattedAddress": This is the most important field. Based on your full analysis, create a single, clean, human-readable, and comprehensive shipping-ready address string. It should contain all specific details (H.no., Room No., etc.), followed by locality, street, colony, P.O., Tehsil, and District. DO NOT include the State or PIN in this string. Use commas to separate logical components. Do not invent or "hallucinate" information.
11. "LocationType": Identify the type of location (e.g., "Village", "Town", "City", "Urban Area").
12. "AddressQuality": Analyze the address completeness and clarity for shipping. Categorize it as one of the following: Very Good, Good, Medium, Bad, or Very Bad.
13. "LocationSuitability": Analyze the location based on its State, District, and PIN to determine courier-friendliness in India. Categorize it as one of the following: Prime Location, Tier 1 & 2 Cities, Remote/Difficult Location, or Non-Serviceable Location.

Raw Address: "${originalAddress}"
`;

    if (postalData.PinStatus === 'Success') {
        basePrompt += `\nOfficial Postal Data: ${JSON.stringify(postalData.PostOfficeList)}\nUse this list to find the best match for 'P.O.', 'Tehsil', and 'DIST.' fields.`;
    } else {
        basePrompt += `\nAddress has no PIN or the PIN is invalid. You must find and verify the correct 6-digit PIN. If you cannot find a valid PIN, set "PIN" to null and provide the best available data.`;
    }
    
    // Add the JSON output instruction
    basePrompt += `\nYour entire response MUST be a single, valid JSON object starting with { and ending with } and contain ONLY the keys listed above.`;

    return basePrompt;
}

function processAddress(address, postalData) {
    const prompt = buildGeminiPrompt(address, postalData);
    return getGeminiResponse(prompt);
}

// --- 2. MAIN HANDLER ---

module.exports = async (req, res) => {
    // START OF CORS FIX (Step 36)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://pankajbossgu.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ status: "Error", error: 'Method Not Allowed' });
        return;
    }
    // END OF CORS FIX

    try {
        const { address, customerName } = req.body;
        
        if (!address) {
            return res.status(400).json({ status: "Error", error: "Address is required." });
        }

        const cleanedName = customerName.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim() || null;
        const initialPin = extractPin(address);
        let postalData = { PinStatus: 'Error' };
        
        if (initialPin) {
            postalData = await getIndiaPostData(initialPin);
        }

        // 1. Call Gemini API
        const geminiResult = await processAddress(address, postalData);
        if (geminiResult.error || !geminiResult.text) {
            return res.status(500).json({ status: "Error", error: geminiResult.error || "Gemini API failed to return text." });
        }

        // 2. Parse Gemini JSON output
        let parsedData;
        try {
            // Attempt to clean up and parse the JSON string
            const jsonText = geminiResult.text.replace(/```json|```/g, '').trim();
            parsedData = JSON.parse(jsonText);
        } catch (e) {
            console.error("JSON Parsing Error:", e.message);
            return res.status(500).json({ status: "Error", error: "Failed to parse Gemini output as JSON.", rawOutput: geminiResult.text });
        }

        // 3. Final cleanup and formatting
        
        // Extract and verify PIN again from parsed data
        const finalPin = String(parsedData.PIN).match(/\b\d{6}\b/) ? parsedData.PIN : initialPin;

        // Re-run India Post lookup if Gemini suggested a different PIN or if initial lookup failed
        if (finalPin && finalPin !== initialPin) {
            const finalPostalData = await getIndiaPostData(finalPin);
            if (finalPostalData.PinStatus === 'Success') {
                postalData = finalPostalData;
            }
        }

        // Select the first post office data for final output
        const primaryPostOffice = postalData.PostOfficeList ? postalData.PostOfficeList[0] : {};

        // 4. Construct the Final JSON Response
        const finalResponse = {
            status: "Success",
            customerRawName: customerName,
            customerCleanName: cleanedName,
            
            // Core Address Components
            addressLine1: parsedData.FormattedAddress || address.replace(meaninglessRegex, '').trim() || '',
            landmark: parsedData.Landmark || '',
            
            // Geographic Components (Prioritize India Post verification)
            postOffice: primaryPostOffice.Name || parsedData['P.O.'] || '',
            tehsil: primaryPostOffice.Taluk || parsedData.Tehsil || '',
            district: primaryPostOffice.District || parsedData['DIST.'] || '',
            state: primaryPostOffice.State || parsedData.State || '',
            pin: finalPin || parsedData.PIN || null,

            // Quality/Verification Metrics
            addressQuality: parsedData.AddressQuality || 'Medium',
            locationType: parsedData.LocationType || 'Unknown',
            locationSuitability: parsedData.LocationSuitability || 'Unknown',
            
            // Remarks
            remarks: parsedData.Remaining || 'Address verified and formatted successfully.',
        };

        return res.status(200).json(finalResponse);

    } catch (e) {
        console.error("Internal Server Error:", e);
        return res.status(500).json({ status: "Error", error: `Internal Server Error: ${e.message}` });
    }
};
