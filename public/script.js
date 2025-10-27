// public/script.js (REPLACE existing fetchVerification function)

async function fetchVerification(address, name) {
    try {
        const API_ENDPOINT_BULK = "https://address-verification-app.vercel.app/api/verify-single-address";

        const response = await fetch(API_ENDPOINT_BULK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address, customerName: name })
        });
        
        let result = {};
        let rawResponseText = "";
        try {
            // Try to parse JSON first
            rawResponseText = await response.text();
            result = JSON.parse(rawResponseText);
        } catch (e) {
            // Non-JSON response (likely a Vercel 504 Timeout or 500 error page)
            console.error("Non-JSON API response in bulk. Status:", response.status, "Raw Text:", rawResponseText);
            return {
                status: "Error",
                customerCleanName: name,
                addressLine1: "Server Error",
                remarks: `API Failed: Server returned non-JSON error or timed out (${response.status}).`,
                addressQuality: "VERY BAD"
            };
        }

        
        if (response.ok && result.status === "Success") {
            return result;
        } else {
            // API returned JSON error (e.g., API key missing or specific Gemini failure)
            return {
                status: "Error",
                customerCleanName: name,
                addressLine1: "API Error",
                landmark: "",
                state: "",
                district: "",
                pin: "",
                remarks: `API Failed: ${result.error || result.remarks || 'Unknown Server Error.'}`,
                addressQuality: "BAD"
            };
        }
    } catch (e) {
        console.error("Bulk Fetch Error (Network):", e);
        // True network/timeout error (browser side)
        return {
            status: "Error",
            customerCleanName: name,
            addressLine1: "Network/Timeout Error",
            landmark: "",
            state: "",
            district: "",
            pin: "",
            remarks: "Network or timeout error during API call. The Vercel function may be timing out (504).",
            addressQuality: "VERY BAD"
        };
    }
}
