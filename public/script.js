// public/script.js

const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

document.addEventListener('DOMContentLoaded', () => {
    // --- SINGLE PAGE INITIALIZATION ---
    const verifyButton = document.getElementById('verifyButton');
    if (verifyButton) {
        verifyButton.addEventListener('click', handleSingleVerification);
    }
    
    // --- BULK PAGE INITIALIZATION ---
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');

    if (downloadTemplateButton) {
        downloadTemplateButton.addEventListener('click', handleTemplateDownload);
    }

    if (csvFileInput) {
        // Enable process button only if a file is selected
        csvFileInput.addEventListener('change', () => {
            if (processButton) {
                processButton.disabled = !csvFileInput.files.length;
            }
        });
    }

    if (processButton) {
        processButton.addEventListener('click', handleBulkVerification);
    }
});

// --- API FETCH FUNCTION (Handles Access Code and Retries) ---
async function fetchVerification(address, name, accessCode = null) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Create bodyData and conditionally add accessCode
            const bodyData = { address: address, customerName: name }; 
            if (accessCode) { 
                bodyData.accessCode = accessCode; // Pass code for bulk operations
            }

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            // Handle unauthorized error specifically (401 from Vercel API)
            if (response.status === 401) {
                 // Throw a critical error to be caught by the bulk handler to stop processing
                 throw new Error("Unauthorized Access. The previously verified code is no longer valid or session expired.");
            }
            
            let result;
            try {
                result = await response.json();
            } catch (e) {
                console.error("Non-JSON API response. Status:", response.status);
                // Non-critical API error, return for the loop to continue
                return { status: "Error", error: `Server Error (${response.status})` };
            }

            // If success or a handled error (e.g. 400 Bad Request which returns JSON), return immediately
            return result; 

        } catch (e) {
            lastError = e;
            console.error(`Verification API Attempt ${attempt + 1} failed:`, e);
            
            // Re-throw the 401 error immediately, stopping the retry loop
            if (e.message.includes("Unauthorized Access")) {
                throw e;
            }

            if (attempt < maxRetries - 1) {
                // Wait for an exponential backoff before next retry
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }
    
    // If all retries fail, return a default error structure
    return { 
        status: "Error", 
        error: `Verification failed after ${maxRetries} attempts.`,
        remarks: `Error: ${lastError ? lastError.message : 'Unknown Network Error'}`,
        customerCleanName: name,
        addressLine1: "API Error: See Remarks",
        landmark: "",
        state: "",
        district: "",
        pin: "",
        addressQuality: "VERY BAD"
    };
}
// --- END API FETCH FUNCTION ---

// --- SINGLE VERIFICATION HANDLER (No Access Code Required) ---
async function handleSingleVerification() {
    // ... (Your existing handleSingleVerification logic remains the same, but it now calls the more robust fetchVerification) ...
    const rawAddress = document.getElementById('rawAddress').value;
    const customerName = document.getElementById('customerName').value;
    const loadingMessage = document.getElementById('loading-message');
    const resultsContainer = document.getElementById('resultsContainer');
    const verifyButton = document.getElementById('verifyButton');

    if (rawAddress.trim() === "") {
        alert("Please enter a raw address to verify.");
        return;
    }

    verifyButton.disabled = true;
    loadingMessage.style.display = 'block';
    resultsContainer.style.display = 'none';

    try {
        const result = await fetchVerification(rawAddress, customerName); 

        if (result.status === "Success") {
            displayResults(result);
        } else {
            alert(`Verification Failed: ${result.error || result.remarks || "Unknown error."}`);
            displayErrorResult(result);
        }

    } catch (e) {
        console.error("Fetch Error:", e);
        alert(`A critical error occurred: ${e.message}. Check the console for details.`);
    } finally {
        verifyButton.disabled = false;
        loadingMessage.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
}
// --- END SINGLE VERIFICATION HANDLER ---


// --- BULK PAGE UTILITIES (MOVED FROM bulk.html) ---

/**
 * Function to handle status message display, including errors
 */
function updateStatusMessage(message, isError = false) {
    const statusMessage = document.getElementById('status-message');
    if (!statusMessage) return; // Exit if element is not present (e.g., on single.html)

    statusMessage.textContent = message;
    
    // Reset colors
    statusMessage.classList.remove('text-red-700', 'bg-red-100', 'text-gray-600', 'font-bold');
    
    // Ensure basic styling is applied
    if (!statusMessage.classList.contains('p-2')) {
        statusMessage.classList.add('p-2', 'rounded'); 
    }

    if (isError) {
        statusMessage.classList.add('text-red-700', 'bg-red-100', 'font-bold');
    } else {
        statusMessage.classList.add('text-gray-600');
        statusMessage.classList.remove('bg-red-100');
    }
}

/**
 * Parses the CSV text content into an array of address objects.
 * NOTE: This is a basic parser. For true robustness, consider a library like PapaParse.
 */
function parseCSV(text) {
    // Split by the actual newline character '\n'
    const lines = text.split('\n'); 
    if (lines.length < 2) return [];

    // Simple split for headers (handles the first row)
    const header = lines[0].split(',').map(h => h.trim().toUpperCase().replace(/^\"|\"$/g, ''));
    const data = [];
    
    // Indices for required columns
    const idIndex = header.indexOf('ORDER ID');
    const nameIndex = header.indexOf('CUSTOMER NAME');
    const addressIndex = header.indexOf('CUSTOMER RAW ADDRESS');

    if (idIndex === -1 || nameIndex === -1 || addressIndex === -1) {
        console.error("CSV header is missing one of the required columns.");
        return [];
    }

    // Start from line 1 to skip header
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        // Using a regex match that can handle basic quoted fields
        const row = lines[i].match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g) || [];
        
        // Clean up quoted values
        const cleanedRow = row.map(cell => cell.trim().replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"'));

        // Ensure the row has enough columns based on max index
        if (cleanedRow.length > Math.max(idIndex, nameIndex, addressIndex)) {
            data.push({
                'ORDER ID': cleanedRow[idIndex],
                'CUSTOMER NAME': cleanedRow[nameIndex],
                'CUSTOMER RAW ADDRESS': cleanedRow[addressIndex],
            });
        }
    }
    return data;
}


// --- BULK VERIFICATION HANDLER ---
async function handleBulkVerification() {
    const fileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    const progressBarFill = document.getElementById('progressBarFill');
    const downloadLink = document.getElementById('downloadLink');

    if (!fileInput || !fileInput.files.length) {
        updateStatusMessage("Please select a CSV file first.", true);
        return;
    }

    // ⭐ CRITICAL: RETRIEVE ACCESS CODE FROM SESSION STORAGE ⭐
    const accessCode = sessionStorage.getItem('bulkAccessCode');
    if (!accessCode) {
        updateStatusMessage("Bulk verification cancelled. Please return to the home page and enter the access code first.", true);
        return;
    }
    // --------------------------------------------------------

    const file = fileInput.files[0];
    const reader = new FileReader();

    // Reset UI
    processButton.disabled = true;
    fileInput.disabled = true;
    downloadLink.classList.add('hidden');
    progressBarFill.style.width = '0%';
    updateStatusMessage('Reading file...');
    
    reader.onload = async function(e) {
        const text = e.target.result;
        // Use the centralized parseCSV function
        const addresses = parseCSV(text); 
        
        if (addresses.length === 0) {
            updateStatusMessage("Error: No valid addresses found in CSV. Check format and required columns.", true);
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const totalAddresses = addresses.length;
        let processedCount = 0;
        const outputRows = [];

        updateStatusMessage(`Starting verification of ${totalAddresses} addresses...`);

        // Check for unauthorized access error from the API
        try {
            for (const row of addresses) {
                const orderId = row['ORDER ID'] || '';
                const customerName = row['CUSTOMER NAME'] || '';
                const rawAddress = row['CUSTOMER RAW ADDRESS'] || '';

                let verificationResult;

                if (!rawAddress || rawAddress.trim() === "") { 
                    verificationResult = { status: "Skipped", remarks: "Missing raw address in CSV row.", addressQuality: "Poor", customerCleanName: customerName, addressLine1: "", landmark: "", state: "", district: "", pin: "" };
                } else {
                    // Pass the accessCode
                    verificationResult = await fetchVerification(rawAddress, customerName, accessCode); 
                }

                // Function to escape and quote CSV cell values
                const escapeAndQuote = (cell) => `\"${String(cell || '').replace(/\"/g, '\"\"')}\"`;

                // Format the output row
                const outputRow = [
                    orderId,
                    customerName,
                    rawAddress,
                    verificationResult.customerCleanName,
                    verificationResult.addressLine1,
                    verificationResult.landmark,
                    verificationResult.state,
                    verificationResult.district,
                    verificationResult.pin,
                    verificationResult.remarks,
                    verificationResult.addressQuality
                ].map(escapeAndQuote).join(',');

                outputRows.push(outputRow);
                
                processedCount++;
                const progress = (processedCount / totalAddresses) * 100;
                progressBarFill.style.width = `${progress}%`;
                
                updateStatusMessage(`Processing... ${processedCount} of ${totalAddresses} addresses completed.`);
            }

            // SUCCESS
            updateStatusMessage(`Processing complete! ${totalAddresses} addresses verified. Click 'Download Verified CSV'.`, false);
            createAndDownloadCSV(outputRows, "verified_addresses.csv");

        } catch (e) {
            // CRITICAL ERROR: Unauthorized Access from fetchVerification
            if (e.message.includes("Unauthorized Access")) {
                updateStatusMessage(`Processing failed: Unauthorized Access. Please reload the home page and enter the correct code.`, true);
                sessionStorage.removeItem('bulkAccessCode'); // Clear the bad code
            } else {
                updateStatusMessage(`A critical error stopped processing at address ${processedCount + 1}: ${e.message}`, true);
            }
            progressBarFill.style.width = `${((processedCount + 1) / totalAddresses) * 100}%`;
        }

        // Final UI cleanup
        processButton.disabled = false;
        fileInput.disabled = false;
    };

    reader.onerror = function() {
        updateStatusMessage("Error reading file.", true);
        processButton.disabled = false;
        fileInput.disabled = false;
    };

    reader.readAsText(file);
}
// --- END BULK VERIFICATION HANDLER ---


// --- DOWNLOAD UTILITY FUNCTIONS (Centralized) ---

function handleTemplateDownload() {
    // Corrected to ensure proper CSV line endings
    const templateHeaders = "ORDER ID,CUSTOMER NAME,CUSTOMER RAW ADDRESS\n";
    const templateData = 
        "1,\"John Doe\",\"H.No. 123, Sector 40B, near bus stand, Chandigarh\"\n" +
        "2,\"Jane Smith\",\"5th Floor, Alpha Tower, Mumbai 400001\"\n";
        
    const csvContent = templateHeaders + templateData;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'address_verification_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function createAndDownloadCSV(rows, filename) {
    // Create header row manually for consistency
    const header = "ORDER ID,CUSTOMER NAME,CUSTOMER RAW ADDRESS,CLEAN NAME,CLEAN ADDRESS LINE 1,LANDMARK,STATE,DISTRICT,PIN,REMARKS,QUALITY\n";
    const csvContent = header + rows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.getElementById('downloadLink');

    if (downloadLink) {
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.classList.remove('hidden');
    } else {
        // Fallback
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// --- SINGLE PAGE DISPLAY UTILITY FUNCTIONS (Kept for completeness) ---

function displayResults(data) {
    document.getElementById('out-name').textContent = data.customerCleanName || 'N/A';
    document.getElementById('out-address').textContent = data.addressLine1 || 'N/A';
    document.getElementById('out-landmark').textContent = data.landmark || 'N/A';
    document.getElementById('out-state').textContent = data.state || 'N/A';
    document.getElementById('out-district').textContent = data.district || 'N/A';
    document.getElementById('out-pin').textContent = data.pin || 'N/A';
    document.getElementById('out-remarks').textContent = data.remarks || 'No issues found.';
    document.getElementById('out-quality').textContent = data.addressQuality || 'N/A';
}

function displayErrorResult(data) {
    document.getElementById('out-name').textContent = data.customerCleanName || '---';
    document.getElementById('out-address').textContent = data.addressLine1 || 'API ERROR';
    document.getElementById('out-landmark').textContent = '---';
    document.getElementById('out-state').textContent = data.state || '---';
    document.getElementById('out-district').textContent = data.district || '---';
    document.getElementById('out-pin').textContent = data.pin || '---';
    document.getElementById('out-remarks').textContent = data.remarks || data.error || 'Verification failed.';
    document.getElementById('out-quality').textContent = 'BAD';
}
// --- END UTILITY FUNCTIONS ---
