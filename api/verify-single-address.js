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
    "tq", "job", "dist", "vpo" // <<< FIX: Added VPO for local cleanup
];

// Combine both lists for comprehensive cleanup
const meaningfulWords = [...coreMeaningfulWords, ...testingKeywords];

const meaninglessRegex = new RegExp(`\\b(?:${meaningfulWords.join('|')})\\b`, 'gi');
// directionalKeywords array is used for the Landmark Prefix Logic
const directionalKeywords = ['near', 'opposite', 'back side', 'front side', 'behind', 'opp']; 

// Keywords for Component Leakage Check (Structural Fix)
const leakageKeywords = ['road', 'street', 'lane', 'colony', 'apartment', 'bldg', 'area', 'nagar', 'vihar', 'marg', 'vpo', 'po', 'tq']; 
const leakageRegex = new RegExp(`\\b(?:${leakageKeywords.join('|')})\\b`, 'gi');


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
    let basePrompt = `You are an expert Indian address verifier and formatter. Your task is to process a raw address, perform a thorough analysis, and provide a comprehensive response in a single JSON object. Provide all responses in English only. Strictly translate all extracted address components to English. **Apply aggressive, context-aware correction for common phonetic and transliteration errors** (e.g., 'rd' to 'Road', 'nager' to 'Nagar', 'vihar' to 'Vihar', 'mar' to 'Marg', 'col' to 'Colony', 'aprtment' to 'Apartment', 'nd' to '2nd'). **Use standard, formal, full English wording for all component names** (e.g., 'Road' instead of 'Rd', 'Lane' instead of 'Ln'). Be strict about ensuring the output is a valid, single, and complete address for shipping. Use your advanced knowledge to identify and remove any duplicate address components that are present consecutively (e.g., 'Gandhi Street Gandhi Street' should be 'Gandhi Street').

Your response must contain the following keys:
1.  "H.no.", "Flat No.", "Plot No.", "Room No.", "Building No.", "Block No.", "Ward No.", "Gali No.", "Zone No.": Extract only the number or alphanumeric sequence (e.g., '1-26', 'A/25', '10'). Set to null if not found.
2.  "Colony", "Street", "Locality", "Building Name", "House Name", "Floor": Extract the name. **Crucially, if the raw address contains V.P.O. (Village and Post Office), extract the village/town name associated with it (e.g., 'Bujrak' from 'V.P.O. Bujrak') and incorporate the village name here or in the 'FormattedAddress'.**
3.  "P.O.": The official Post Office name from the PIN data. Prepend "P.O." to the name. Example: "P.O. Boduppal".
4.  "Tehsil": The official Tehsil/SubDistrict from the PIN data. Prepend "Tehsil". Example: "Tehsil Pune".
5.  "DIST.": The official District from the PIN data.
6.  "State": The official State from the PIN data.
7.  "PIN": The 6-digit PIN code. Find and verify the correct PIN. If a PIN exists in the raw address but is incorrect, find the correct one and provide it.
8.  "Landmark": A specific, named landmark (e.g., "Apollo Hospital"), not a generic type like "school". If multiple landmarks are present, list them comma-separated. Extract the landmark without any directional words like 'near', 'opposite', 'behind' etc., as this will be handled by the script.
9.  "Remaining": A last resort for any text that does not fit into other fields. Clean this by removing meaningless words like 'job', 'raw', 'add-', 'tq', 'dist' and country, state, district, or PIN code. **Ensure all recognized Indian address and postal abbreviations (like V.P.O., P.O., T.Q.) are parsed out and ONLY truly ambiguous, non-address components remain here.**
10. "FormattedAddress": This is the most important field. Based on your full analysis, create a single, clean, human-readable, and comprehensive shipping-ready address string. **Prioritize components in the typical delivery order: [Premise/H.No./Flat No.] followed by [Street/Colony/Locality] and then [Town/City/P.O./Tehsil]**. DO NOT include the State or PIN in this string. Use commas to separate logical components. Do not invent or "hallucinate" information.
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
        let remarks = []; // Initialize remarks array
        
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
        let finalPin = String(parsedData.PIN).match(/\b\d{6}\b/) ? parsedData.PIN : initialPin;
        let primaryPostOffice = postalData.PostOfficeList ? postalData.PostOfficeList[0] : {};

        // Store initial successful postal data (if any) before potential overwrite by AI PIN check
        let initialPostalDataSuccess = postalData.PinStatus === 'Success' ? postalData : null;
        
        if (finalPin) {
            // Re-run India Post lookup if PIN is different or original lookup failed
            if (postalData.PinStatus !== 'Success' || (initialPin && finalPin !== initialPin)) {
                const aiPostalData = await getIndiaPostData(finalPin);

                if (aiPostalData.PinStatus === 'Success') {
                    // AI PIN is valid, use its data and update Post Office details
                    postalData = aiPostalData;
                    primaryPostOffice = postalData.PostOfficeList[0] || {};
                    
                    // Add PIN correction remarks
                    if (initialPin && initialPin !== finalPin) {
                        remarks.push(`CRITICAL_ALERT: Wrong PIN (${initialPin}) corrected to (${finalPin}).`);
                    } else if (!initialPin) {
                        remarks.push(`Correct PIN (${finalPin}) added by AI.`);
                    }
                } else {
                    // AI PIN also failed API check, warn the user and revert PIN if possible
                    remarks.push(`CRITICAL_ALERT: AI-provided PIN (${finalPin}) not verified by API.`);
                    finalPin = initialPin; // Revert to original, which might be valid or invalid
                }
            } else if (initialPin && postalData.PinStatus === 'Success') {
                remarks.push(`PIN (${initialPin}) verified successfully.`);
            }
        } else {
            // If neither original nor AI could find a valid PIN
            remarks.push("CRITICAL_ALERT: PIN not found after verification attempts. Manual check needed.");
            finalPin = initialPin || null; // Fallback to initialPin even if invalid, for user reference
        }
        
        // --- 4. ADVANCED DEEP THINKING LOGICS ---
        
        const apiState = primaryPostOffice.State ? primaryPostOffice.State.toLowerCase() : '';
        const apiDistrict = primaryPostOffice.District ? primaryPostOffice.District.toLowerCase() : '';
        const rawAddressLower = address.toLowerCase();
        
        // 4.1. Semantic PIN Discrepancy Check (State/District Mismatch)
        if (postalData.PinStatus === 'Success') {
            const aiState = parsedData.State ? parsedData.State.toLowerCase() : '';
            const aiDistrict = parsedData['DIST.'] ? parsedData['DIST.'] || parsedData['Tehsil'] : '';
            const aiDistrictLower = aiDistrict ? aiDistrict.toLowerCase() : '';

            // Check if the AI's extracted district (from raw text) conflicts with the API's verified district for the PIN
            if (apiDistrict && aiDistrictLower && apiDistrict !== aiDistrictLower) {
                // Only flag if the AI's district is explicitly in the raw address
                if (rawAddressLower.includes(aiDistrictLower.split(' ')[0])) {
                     remarks.push(`CRITICAL_ALERT: Semantic District Mismatch! PIN (${finalPin}) is for '${apiDistrict}' but address mentions '${aiDistrict}'.`);
                }
            }
            
            // Check for State mismatch (less common but critical)
            if (apiState && aiState && apiState !== aiState) {
                if (rawAddressLower.includes(aiState.split(' ')[0])) {
                    remarks.push(`CRITICAL_ALERT: Semantic State Mismatch! PIN (${finalPin}) is for '${apiState}' but address mentions '${aiState}'.`);
                }
            }
        }
        
        // 4.2. Landmark/P.O. Conflict Check (AI vs API)
        if (postalData.PinStatus === 'Success' && primaryPostOffice.Name) {
            const apiPOName = primaryPostOffice.Name.toLowerCase();
            const formattedAddressLower = (parsedData.FormattedAddress || '').toLowerCase();

            if (formattedAddressLower.length > 20 && !formattedAddressLower.includes(apiDistrict) && !formattedAddressLower.includes(apiState)) {
                remarks.push(`Deep Check: Formatted address components do not strongly reference the official P.O. (${primaryPostOffice.Name}).`);
            }
        }

        // 4.3. Premise Missing Alert (Structural Integrity)
        const hasPremise = parsedData['H.no.'] || parsedData['Flat No.'] || parsedData['Plot No.'] || parsedData['Room No.'] || parsedData['Building No.'];
        const isLowQuality = parsedData.AddressQuality === 'Bad' || parsedData.AddressQuality === 'Very Bad' || parsedData.AddressQuality === 'Medium';

        if (!hasPremise && isLowQuality) {
            remarks.push(`CRITICAL_ALERT: No House/Flat/Plot Number found. Premise details are missing.`);
        }


        // 4.4. Component Leakage Check (Structural Cleanliness)
        const remainingLower = (parsedData.Remaining || '').toLowerCase();
        if (remainingLower.match(leakageRegex)) {
            remarks.push(`CRITICAL_ALERT: Component Leakage in Remaining Text. Unparsed address elements detected.`);
        }


        // 4.5. Address Component Density Check & Short Address Check
        const meaningfulComponents = [
            parsedData['H.no.'], parsedData['Flat No.'], parsedData['Plot No.'],
            parsedData.Colony, parsedData.Street, parsedData.Locality, 
            parsedData['Building Name'], parsedData.Landmark
        ].filter(c => c && String(c).trim() !== '').length;
        
        const totalAddressLength = (parsedData.FormattedAddress || '').length + (parsedData.Landmark || '').length;

        // Short address check
        if (totalAddressLength < 35 && parsedData.AddressQuality !== 'Very Good' && parsedData.AddressQuality !== 'Good') {
             remarks.push(`CRITICAL_ALERT: Formatted address is short (${totalAddressLength} chars). Manual verification recommended.`);
        }
        
        // Density check
        if (totalAddressLength > 20 && meaningfulComponents < 3) {
            remarks.push(`CRITICAL_ALERT: Low Component Density. Only ${meaningfulComponents} specific components found (H.No., Street, Colony, Landmark, etc.).`);
        }


        // 5. --- Directional Prefix Logic for Landmark ---
        let landmarkValue = parsedData.Landmark || '';
        let finalLandmark = '';

        if (landmarkValue.toString().trim() !== '') {
            const foundDirectionalWord = directionalKeywords.find(keyword => rawAddressLower.includes(keyword));
            
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
        
        // Final Remarks cleanup and addition
        if (parsedData.Remaining && parsedData.Remaining.trim() !== '' && !parsedData.Remaining.includes('JSON parse failed')) {
            remarks.push(`Remaining/Ambiguous Text: ${parsedData.Remaining.trim()}`);
        } else if (remarks.length === 0) {
            remarks.push('Address verified and formatted successfully.');
        }


        // 6. Construct the Final JSON Response
        const finalResponse = {
            status: "Success",
            customerRawName: customerName,
            customerCleanName: cleanedName,
            
            // Core Address Components
            addressLine1: parsedData.FormattedAddress || address.replace(meaninglessRegex, '').trim() || '',
            landmark: finalLandmark, // <<< UPDATED
            
            // Geographic Components (Prioritize India Post verification)
            postOffice: primaryPostOffice.Name || parsedData['P.O.'] || '',
            tehsil: primaryPostOffice.Taluk || parsedData.Tehsil || '',
            district: primaryPostOffice.District || parsedData['DIST.'] || '',
            state: primaryPostOffice.State || parsedData.State || '',
            pin: finalPin, // <<< UPDATED

            // Quality/Verification Metrics
            addressQuality: parsedData.AddressQuality || 'Medium',
            locationType: parsedData.LocationType || 'Unknown',
            locationSuitability: parsedData.LocationSuitability || 'Unknown',
            
            // Remarks
            remarks: remarks.join('; ').trim(), // <<< UPDATED: Send as a single string
        };

        return res.status(200).json(finalResponse);

    } catch (e) {
        console.error("Internal Server Error:", e);
        return res.status(500).json({ status: "Error", error: `Internal Server Error: ${e.message}` });
    }
};
