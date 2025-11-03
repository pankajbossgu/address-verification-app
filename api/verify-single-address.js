// api/verify-single-address.js
// Vercel Serverless Function (Node.js)

// --- 1. CONFIGURATION AND UTILITIES ---
const INDIA_POST_API = 'https://api.postalpincode.in/pincode/';
let pincodeCache = {}; 

const testingKeywords = ['test', 'testing', 'asdf', 'qwer', 'zxcv', 'random', 'gjnj', 'fgjnj']; 
const coreMeaningfulWords = [
    "ddadu", "ddadu", "ai", "add", "add-", "raw", "dumping", "grand", "dumping grand",
    "chd", "chd-", "chandigarh", "chandigarh-", "chandigarh", "west", "sector", "sector-",
    "house", "no", "no#", "house no", "house no#", "floor", "first", "first floor",
    "majra", "colony", "dadu", "dadu majra", "shop", "wine", "wine shop", "house", "number",
    "tq", "job", "dist", 
    // ADDED: Ambiguous words seen in recent data for stricter client-side cleanup
    "sirf", "aata", "gp", "gram panchayat" 
];

// Combine both lists for comprehensive cleanup
// NOTE: These are used for final client-side 'Remaining' check, the detailed prompt is the main cleaner.
const meaningfulWords = [...coreMeaningfulWords, ...testingKeywords];

const meaninglessRegex = new RegExp(`\\b(?:${meaningfulWords.join('|')})\\b`, 'gi');
// directionalKeywords array is used for the Landmark Prefix Logic
const directionalKeywords = ['near', 'opposite', 'back side', 'front side', 'behind', 'opp']; 

// ADDED: List of prefixes/suffixes to remove from names
const nameCleanupWords = [
    'mr', 'mrs', 'ms', 'dr', 'prof', 'engr', 'pvt', 'ltd', 'private', 'limited', 'co', 'company',
    'proprietor', 'prop', 'firm', 'group', 'the', 's/o', 'd/o', 'c/o', 'son of', 'daughter of', 
    // Added more to remove organizational prefixes
    'shri', 'smt', 'md', 'sh.', 'm/s', 'karta', 'huf'
];
const nameCleanupRegex = new RegExp(`\\b(?:${nameCleanupWords.join('|')})\\b`, 'gi');

/**
 * Standardizes and cleans the customer name.
 * @param {string} name - The raw customer name string.
 * @returns {string} The cleaned and standardized name.
 */
function cleanCustomerName(name) {
    if (!name) return null;
    let cleaned = String(name)
        // Remove special characters, keeping only letters, numbers, and spaces
        .replace(/[^\w\s]/gi, '') 
        // Remove common prefixes/suffixes (case-insensitive)
        .replace(nameCleanupRegex, '')
        // Replace multiple spaces with a single space
        .replace(/\s+/g, ' ')
        .trim();

    // Capitalize each word (Title Case) for standardization
    cleaned = cleaned.toLowerCase().split(' ').map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');

    return cleaned || null;
}


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

    // NOTE: Using gemini-2.5-flash for enhanced reasoning and speed
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // --- ENHANCEMENT: Tool calling for external web search (if needed) ---
    // The model will decide if a search is necessary based on the prompt's request for external knowledge.
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            // Enable Google Search as a tool for grounding and external lookup
            tools: [{ googleSearch: {} }],
        }
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
    // --- UPDATED PROMPT FOR ENHANCED INTELLIGENCE AND STRICTER OUTPUT ---
    let basePrompt = `You are an expert Indian address verifier and formatter. Your task is to process a raw address, perform a thorough analysis, and provide a comprehensive response in a single JSON object.

**CRITICAL INSTRUCTION:**
1.  **Language and Spelling:** Strictly translate/transliterate all local language text (Hindi, Hinglish, etc.) into **standard, clean English**. Correct all common spelling and phonetic errors (e.g., 'nager' to 'Nagar', '2nd' to 'Second').
2.  **External Knowledge & Verification:** Use your advanced knowledge and **Google Search Tool** to verify missing or suspicious components. If only a major landmark and city are provided, use the search to infer a potential locality or PIN code. If a company name is present (e.g., 'Stahl india company'), search for and use its official, full name (e.g., 'Stahl India Pvt. Ltd.') as the primary entity in the 'FormattedAddress'.
3.  **Component Integration:** Analyze ALL location-related text and integrate it fully into the 'FormattedAddress' and other component fields. The 'Remaining' field must **ONLY** contain truly meaningless, junk, or non-address text. **DO NOT** place any valid names of Banks, Hospitals, Schools, or recognized Locality/Street names into the 'Remaining' field.
4.  **Formatting:** Be strict about ensuring the output is a valid, single, and complete address for shipping. Remove duplicate components (e.g., 'Gandhi Street Gandhi Street' should be 'Gandhi Street').

Your response must contain the following keys and data structure:
1.  "H.no.": Extract only the number or alphanumeric sequence (e.g., '1-26', 'A/25', '10') for the house/flat/plot number. Set to null if not found.
2.  "Colony": Extract the name of the Colony/Area.
3.  "Street": Extract the name of the Street/Lane/Gali.
4.  "Locality": Extract the name of the major Locality or Sector.
5.  "Building": Extract the name of the specific Building, House Name, or Complex.
6.  "Floor": Extract the specific floor (e.g., 'First Floor').
7.  "P.O.": The official Post Office name from the PIN data. Prepend "P.O." to the name. Example: "P.O. Boduppal".
8.  "Tehsil": The official Tehsil/SubDistrict from the PIN data. Prepend "Tehsil". Example: "Tehsil Pune".
9.  "DIST.": The official District from the PIN data.
10. "State": The official State from the PIN data.
11. "PIN": The 6-digit PIN code. **Find and verify the correct PIN.** If a PIN exists in the raw address but is incorrect, find the correct one and provide it.
12. "Landmark": A specific, named landmark (e.g., "Apollo Hospital"). Do not include directional words ('near', 'opposite'). Set to null if only generic words are present.
13. "Remaining": Text that is truly junk/meaningless. Must be empty or null for a 'Very Good' address.
14. "FormattedAddress": The final, clean, human-readable, shipping-ready address string. It must contain the Entity (if company name was found) followed by specific details (H.no., Floor, etc.), Locality, Street, Colony, P.O., Tehsil, and District. **DO NOT include the State or PIN in this string.** Use commas to separate logical components.
15. "LocationType": Identify the type (e.g., "Village", "Town", "City", "Urban Area").
16. "AddressQuality": Assess for shipping clarity (Very Good, Good, Medium, Bad, or Very Bad).
17. "LocationSuitability": Assess courier-friendliness (Prime Location, Tier 1 & 2 Cities, Remote/Difficult Location, or Non-Serviceable Location).

Raw Address: "${originalAddress}"
`;

    if (postalData.PinStatus === 'Success') {
        basePrompt += `\nOfficial Postal Data: ${JSON.stringify(postalData.PostOfficeList)}\nUse this list to find the best match for 'P.O.', 'Tehsil', and 'DIST.' fields.`;
    } else {
        basePrompt += `\nAddress has no PIN or the PIN is invalid. You MUST use external web search and your knowledge to find and verify the correct 6-digit PIN. If you cannot find a valid PIN, set "PIN" to null and provide the best available data.`;
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
        let remarks = []; // Initialize remarks array
        
        if (!address) {
            return res.status(400).json({ status: "Error", error: "Address is required." });
        }

        // UPDATED: Use the new dedicated cleaning function
        const cleanedName = cleanCustomerName(customerName);
        const initialPin = extractPin(address);
        let postalData = { PinStatus: 'Error' };
        
        if (initialPin) {
            // First attempt to verify PIN
            postalData = await getIndiaPostData(initialPin);
        }

        // 1. Call Gemini API (with search capability enabled via config)
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
            // VITAL: Add critical alert for JSON failure
            remarks.push(`CRITICAL_ALERT: JSON parse failed. Raw Gemini Output: ${geminiResult.text.substring(0, 50)}...`);
            // Continue with fallback data
            parsedData = {
                FormattedAddress: address.replace(meaninglessRegex, '').trim(),
                Landmark: '',
                State: '',
                DIST: '',
                PIN: initialPin,
                AddressQuality: 'Very Bad',
                Remaining: remarks[0], // Use the error as remaining
            };
        }

        // 3. --- PIN VERIFICATION & CORRECTION LOGIC ---
        // Ensure finalPin is a string and a valid 6-digit number, prioritizing Gemini's output
        let finalPin = String(parsedData.PIN).match(/^\d{6}$/) ? parsedData.PIN : initialPin;
        let primaryPostOffice = postalData.PostOfficeList ? postalData.PostOfficeList[0] : {};

        if (finalPin && finalPin !== initialPin) {
             // If Gemini corrected the PIN or added a new one, re-run verification
            const aiPostalData = await getIndiaPostData(finalPin);

            if (aiPostalData.PinStatus === 'Success') {
                // AI PIN is valid, use its data and update Post Office details
                postalData = aiPostalData;
                primaryPostOffice = postalData.PostOfficeList[0] || {};
                
                // Add PIN correction remarks
                if (initialPin) {
                    remarks.push(`PIN (${initialPin}) was incorrect. Corrected to (${finalPin}) and verified.`);
                } else {
                    remarks.push(`Correct PIN (${finalPin}) inferred by AI and verified.`);
                }
            } else {
                // AI PIN also failed API check, warn the user and revert PIN if possible
                remarks.push(`CRITICAL_ALERT: AI-provided PIN (${finalPin}) not verified by API. Reverting to original PIN (${initialPin || 'N/A'}).`);
                finalPin = initialPin; // Revert to original, which might be valid or invalid
            }
        } else if (initialPin && postalData.PinStatus === 'Success') {
             // Original PIN was used and verified
            remarks.push(`PIN (${initialPin}) verified successfully.`);
        } else if (finalPin && postalData.PinStatus !== 'Success') {
            // Case where PIN was in the raw address, but verification failed (e.g., deleted PO)
             remarks.push(`CRITICAL_ALERT: PIN (${finalPin}) found but not verified by India Post API.`);
        }
        
        if (!finalPin) {
             remarks.push("CRITICAL_ALERT: PIN not found after verification attempts. Manual check needed.");
        }
        
        // 3.5. --- Short Address Check ---
        if (parsedData.FormattedAddress && parsedData.FormattedAddress.length < 35 && parsedData.AddressQuality !== 'Very Good' && parsedData.AddressQuality !== 'Good') {
             remarks.push(`CRITICAL_ALERT: Formatted address is short (${parsedData.FormattedAddress.length} chars). Manual verification recommended.`);
        }


        // 4. --- Directional Prefix Logic for Landmark ---
        let landmarkValue = parsedData.Landmark || '';
        const originalAddressLower = address.toLowerCase();
        let finalLandmark = '';

        if (landmarkValue.toString().trim() !== '') {
            const foundDirectionalWord = directionalKeywords.find(keyword => originalAddressLower.includes(keyword));
            
            if (foundDirectionalWord) {
                // Find the original spelling of the directional word in the raw address
                const originalDirectionalWordMatch = address.match(new RegExp(`\\b${foundDirectionalWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'));
                const originalDirectionalWord = originalDirectionalWordMatch ? originalDirectionalWordMatch[0] : foundDirectionalWord;
                
                // Capitalize the first letter for clean display
                const prefixedWord = originalDirectionalWord.charAt(0).toUpperCase() + originalDirectionalWord.slice(1);
                
                finalLandmark = `${prefixedWord} ${landmarkValue.toString().trim()}`;
            } else {
                // If no directional word is found, use "Near" as the default
                finalLandmark = `Near ${landmarkValue.toString().trim()}`;
            }
        }
        
        // ----------------------------------------------------------------------
        // CRITICAL FIX: Explicitly clean the Remaining field before checking it
        // ----------------------------------------------------------------------
        let finalRemaining = parsedData.Remaining || '';
        // Apply the cleaning regex to remove meaningless words and trim whitespace
        finalRemaining = finalRemaining.replace(meaninglessRegex, '').trim();
        // Consolidate any multiple spaces left by the regex replacement
        finalRemaining = finalRemaining.replace(/\s{2,}/g, ' ');

        if (finalRemaining !== '') {
            // If anything is left after the client-side scrub, it is truly ambiguous
            remarks.push(`Ambiguous Text: ${finalRemaining}`);
        }
        // ----------------------------------------------------------------------
        
        // Add success message only if no other critical remarks exist
        if (remarks.length === 0) {
            remarks.push('Address verified and formatted successfully.');
        }


        // 5. Construct the Final JSON Response
        const finalResponse = {
            status: "Success",
            customerRawName: customerName,
            customerCleanName: cleanedName, 
            
            // Core Address Components
            addressLine1: parsedData.FormattedAddress || address.replace(meaninglessRegex, '').trim() || '',
            landmark: finalLandmark, 
            
            // Geographic Components (Prioritize India Post verification)
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
            remarks: remarks.join('; ').trim(), 
        };

        return res.status(200).json(finalResponse);

    } catch (e) {
        console.error("Internal Server Error:", e);
        return res.status(500).json({ status: "Error", error: `Internal Server Error: ${e.message}` });
    }
};
