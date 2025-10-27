// Set up global elements for both single.html and bulk.html to avoid null errors.
const rawAddressInput = document.getElementById('rawAddress');
const verifyButton = document.getElementById('verifyButton');
const loadingMessage = document.getElementById('loading-message');
const resultsContainer = document.getElementById('resultsContainer');

// Elements common to all pages for modal
const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCloseButton = document.getElementById('modalCloseButton');

// Elements specific to bulk.html
const downloadTemplateButton = document.getElementById('downloadTemplateButton');
const csvFileInput = document.getElementById('csvFileInput');
const processButton = document.getElementById('processButton');
const statusMessage = document.getElementById('status-message');
const progressBarFill = document.getElementById('progressBarFill');
const downloadLink = document.getElementById('downloadLink');

// --- 1. UTILITY FUNCTIONS (Used by all pages) ---

/**
 * Shows the custom modal with a title and message. Replaces alert().
 * @param {string} title The title for the modal.
 * @param {string} message The message content.
 * @param {string} type 'Error', 'Success', or 'Info' (optional)
 */
function showCustomModal(title, message, type = 'Info') {
    if (!customModal) return; // Exit if modal elements don't exist

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Reset colors
    modalTitle.classList.remove('text-danger-red', 'text-primary-green', 'text-primary-blue');
    
    // Apply type-specific colors
    if (type === 'Error') {
        modalTitle.classList.add('text-danger-red');
    } else if (type === 'Success') {
        modalTitle.classList.add('text-primary-green');
    } else {
        modalTitle.classList.add('text-primary-blue');
    }

    customModal.classList.remove('hidden');
    customModal.classList.add('flex');
}

/**
 * Hides the custom modal.
 */
function hideCustomModal() {
    if (customModal) {
        customModal.classList.add('hidden');
        customModal.classList.remove('flex');
    }
}


/**
 * Extracts a 6-digit PIN from a string.
 * @param {string} address The address string.
 * @returns {string|null} The PIN code or null.
 */
function extractPin(address) {
    const match = String(address).match(/\b\d{6}\b/);
    return match ? match[0] : null;
}

/**
 * Converts CSV text into an array of JavaScript objects.
 * Assumes the first row is headers.
 * @param {string} csvText The raw CSV string.
 * @returns {Array<Object>} Array of objects.
 */
function csvToObjects(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // Skip empty lines
        
        // Simple split by comma, works for basic CSV without quoted fields
        const values = line.split(','); 
        const obj = {};

        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = (values[j] || '').trim();
        }
        result.push(obj);
    }
    return result;
}

/**
 * Converts an array of objects into a CSV string.
 * @param {Array<Object>} data Array of objects.
 * @param {Array<string>} headers Optional list of headers/keys to include and order.
 * @returns {string} The CSV formatted string.
 */
function objectsToCsv(data, headers) {
    if (!data || data.length === 0) return '';
    
    // Determine headers if not provided
    const keys = headers || Object.keys(data[0]);
    
    // Create CSV rows
    const csvRows = [];

    // Header row
    csvRows.push(keys.join(','));

    // Data rows
    for (const row of data) {
        const values = keys.map(key => {
            const value = String(row[key] || '');
            // Simple quoting: escape double quotes and wrap value in double quotes if it contains a comma or quote
            const escaped = value.replace(/"/g, '""');
            return value.includes(',') || value.includes('"') || value.includes('\n') ? `"${escaped}"` : value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

/**
 * Makes the API call to the single address verification endpoint with exponential backoff.
 * @param {Object} record - Must contain 'RawAddress' and optionally 'CustomerName'.
 * @returns {Promise<Object>} The API response object.
 */
async function verifyAddressApi(record) {
    // NOTE: In Vercel environment, relative path to serverless function should work
    const apiEndpoint = '/api/verify-single-address'; 
    const maxRetries = 3;
    let delay = 1000; // Start delay at 1 second for exponential backoff

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: record.RawAddress,
                    customerName: record.CustomerName || ''
                })
            });

            const data = await response.json();

            if (response.ok && data.status === "Success") {
                return data;
            } else if (response.status === 429) { 
                // Rate limiting response
                console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue; 
            } else {
                // Non-rate limit error or unsuccessful status
                throw new Error(data.error || `API responded with status ${response.status}`);
            }

        } catch (error) {
            console.error(`API Call Error (Attempt ${attempt + 1}):`, error.message);
            if (attempt === maxRetries - 1) {
                // Last attempt failed
                return { status: "Error", error: `Failed to verify address after ${maxRetries} attempts: ${error.message}` };
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}


// --- 2. MAIN EXECUTION WRAPPED IN DOMContentLoaded ---

// THIS IS THE CRITICAL CHANGE: Ensure all event listeners are attached only after the HTML is fully loaded.
document.addEventListener('DOMContentLoaded', () => {

    // Add event listener to close the modal (must be inside DOMContentLoaded)
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', hideCustomModal);
    }

    // --- A. SINGLE PAGE LOGIC (Runs only if verifyButton exists) ---
    if (verifyButton && rawAddressInput) {
        verifyButton.addEventListener('click', async () => {
            const rawAddress = rawAddressInput.value.trim();
            const customerName = document.getElementById('customerName').value.trim();

            if (!rawAddress) {
                showCustomModal('Input Error', 'Please enter a raw address to verify.', 'Error');
                return;
            }

            verifyButton.disabled = true;
            loadingMessage.style.display = 'block';
            if (resultsContainer) resultsContainer.style.display = 'none';

            try {
                const result = await verifyAddressApi({ RawAddress: rawAddress, CustomerName: customerName });

                loadingMessage.style.display = 'none';
                verifyButton.disabled = false;

                if (result.status === "Success") {
                    // Map API response to output fields
                    document.getElementById('out-name').textContent = result.customerCleanName || 'N/A';
                    document.getElementById('out-address').textContent = result.addressLine1 || 'N/A';
                    document.getElementById('out-landmark').textContent = result.landmark || 'N/A';
                    document.getElementById('out-state').textContent = result.state || 'N/A';
                    document.getElementById('out-district').textContent = result.district || 'N/A';
                    document.getElementById('out-pin').textContent = result.pin || 'N/A';
                    document.getElementById('out-quality').textContent = result.addressQuality || 'N/A';
                    document.getElementById('out-remarks').textContent = result.remarks || 'N/A';

                    // Update quality badge color based on API result
                    const qualityDiv = document.getElementById('out-quality');
                    if (qualityDiv) {
                        // Remove existing color classes
                        qualityDiv.classList.remove('text-primary-green', 'text-secondary-yellow', 'text-danger-red');

                        if (result.addressQuality && result.addressQuality.includes('Good')) {
                            qualityDiv.classList.add('text-primary-green');
                        } else if (result.addressQuality && result.addressQuality.includes('Medium')) {
                            qualityDiv.classList.add('text-secondary-yellow');
                        } else {
                            qualityDiv.classList.add('text-danger-red');
                        }
                    }

                    if (resultsContainer) resultsContainer.style.display = 'block';
                } else {
                    showCustomModal('Verification Failed', result.error || 'An unexpected error occurred during verification.', 'Error');
                }

            } catch (e) {
                loadingMessage.style.display = 'none';
                verifyButton.disabled = false;
                showCustomModal('Connection Error', `Could not connect to the verification service: ${e.message}`, 'Error');
            }
        });
    }


    // --- B. BULK PAGE LOGIC (Runs only if processButton exists) ---

    if (downloadTemplateButton && csvFileInput && processButton) {
        
        let processedRecords = [];
        let originalHeaders = [];

        // --- 1. Download Template ---
        downloadTemplateButton.addEventListener('click', () => {
            const templateHeaders = ["OrderID", "CustomerName", "RawAddress"];
            const exampleData = [
                { OrderID: 'ORD1001', CustomerName: 'Rahul Sharma', RawAddress: 'h.no 1/2 near apollo hospetl, madhapur, 500081' },
                { OrderID: 'ORD1002', CustomerName: 'Priya Singh', RawAddress: 'flat 3b, sai apt, old mumbai highway, hyd-500045' },
            ];
            
            const csvContent = objectsToCsv(exampleData, templateHeaders);
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'address_verification_template.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Enable file input after template is downloaded
            csvFileInput.disabled = false;
            showCustomModal('Template Downloaded', 'The template CSV has been downloaded. Please fill it out and upload it using the file input below.', 'Info');
        });

        // --- 2. Handle File Upload ---
        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (downloadLink) downloadLink.style.display = 'none';
            processButton.disabled = true;
            if (statusMessage) statusMessage.textContent = 'Reading file...';

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvData = e.target.result;
                    processedRecords = csvToObjects(csvData);
                    
                    if (processedRecords.length === 0) {
                        showCustomModal('File Error', 'The uploaded CSV file is empty or formatted incorrectly.', 'Error');
                        if (statusMessage) statusMessage.textContent = 'Ready to process.';
                        return;
                    }
                    
                    // Validate headers
                    originalHeaders = Object.keys(processedRecords[0]);
                    if (!originalHeaders.includes('RawAddress')) {
                         showCustomModal('File Error', 'Missing required column "RawAddress" in the CSV header.', 'Error');
                         if (statusMessage) statusMessage.textContent = 'Ready to process.';
                         processedRecords = [];
                         return;
                    }
                    
                    if (statusMessage) statusMessage.textContent = `File loaded: ${processedRecords.length} records ready for processing.`;
                    processButton.disabled = false;
                } catch (error) {
                    showCustomModal('File Processing Error', `Could not parse the CSV file: ${error.message}`, 'Error');
                    if (statusMessage) statusMessage.textContent = 'Ready to process.';
                    processedRecords = [];
                }
            };
            reader.readAsText(file);
        });

        // --- 3. Process Bulk Data ---
        processButton.addEventListener('click', async () => {
            if (processedRecords.length === 0) {
                showCustomModal('Input Error', 'Please load a valid CSV file first.', 'Error');
                return;
            }

            processButton.disabled = true;
            csvFileInput.disabled = true;
            downloadTemplateButton.disabled = true;
            if (downloadLink) downloadLink.style.display = 'none';
            
            const totalRecords = processedRecords.length;
            const results = [];
            
            for (let i = 0; i < totalRecords; i++) {
                const record = processedRecords[i];
                
                // Update UI
                const percentage = Math.round(((i + 1) / totalRecords) * 100);
                if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
                if (statusMessage) statusMessage.textContent = `Processing record ${i + 1} of ${totalRecords}... (${percentage}%)`;

                // Call API
                const apiResult = await verifyAddressApi(record);
                
                // Prepare the output object
                let outputRecord = { ...record }; // Preserve original data
                
                if (apiResult.status === "Success") {
                    // Add all verified fields to the output record
                    outputRecord = {
                        ...outputRecord,
                        VerifiedStatus: 'Success',
                        AddressLine1_Verified: apiResult.addressLine1 || '',
                        Landmark_Verified: apiResult.landmark || '',
                        PostOffice_Verified: apiResult.postOffice || '',
                        Tehsil_Verified: apiResult.tehsil || '',
                        District_Verified: apiResult.district || '',
                        State_Verified: apiResult.state || '',
                        PIN_Verified: apiResult.pin || '',
                        AddressQuality: apiResult.addressQuality || 'Medium',
                        LocationSuitability: apiResult.locationSuitability || 'Unknown',
                        Remarks: apiResult.remarks || '',
                    };
                } else {
                    // Add error status
                    outputRecord = {
                        ...outputRecord,
                        VerifiedStatus: 'Failed',
                        ErrorDetail: apiResult.error || 'Unknown API failure.',
                        // Fallback to original data for key fields
                        AddressLine1_Verified: record.RawAddress || '',
                        PIN_Verified: extractPin(record.RawAddress) || 'N/A', 
                    };
                }
                
                results.push(outputRecord);

                // Add a small delay between requests to be kind to the serverless function and external APIs
                if (i < totalRecords - 1) {
                    // Delay for 500ms to throttle requests
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                }
            }
            
            // --- 4. Finalize and Download ---
            if (statusMessage) statusMessage.textContent = `Processing complete. ${totalRecords} records verified.`;
            if (progressBarFill) progressBarFill.style.width = '100%';
            
            // Define all possible output headers
            const outputHeaders = [
                ...originalHeaders,
                "VerifiedStatus", "ErrorDetail", "AddressLine1_Verified", "Landmark_Verified",
                "PostOffice_Verified", "Tehsil_Verified", "District_Verified", "State_Verified", 
                "PIN_Verified", "AddressQuality", "LocationSuitability", "Remarks"
            ].filter((value, index, self) => self.indexOf(value) === index); // Ensure unique headers

            const csvOutput = objectsToCsv(results, outputHeaders);

            const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            if (downloadLink) {
                downloadLink.href = url;
                downloadLink.setAttribute('download', `verified_addresses_${Date.now()}.csv`);
                downloadLink.style.display = 'inline-block';
            }

            showCustomModal('Bulk Processing Complete', `Successfully processed ${totalRecords} records. Click 'Download Results CSV' to get your file.`, 'Success');

            // Re-enable input controls
            csvFileInput.disabled = false;
            processButton.disabled = true; // Disable until a new file is loaded
            downloadTemplateButton.disabled = false;
        });
    }

});
