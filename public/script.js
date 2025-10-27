// Global script file for frontend interactions.

// IMPORTANT: Replace this placeholder with your actual Vercel API domain!
const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

document.addEventListener('DOMContentLoaded', () => {
    // --- Setup for single.html ---
    const verifyButton = document.getElementById('verifyButton');
    if (verifyButton) {
        verifyButton.addEventListener('click', handleSingleVerification);
    }
    
    // --- Setup for bulk.html ---
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');

    if (downloadTemplateButton) {
        downloadTemplateButton.addEventListener('click', handleTemplateDownload);
        // Enable input after the template button is ready
        if (csvFileInput) csvFileInput.disabled = false;
    }

    if (csvFileInput) {
        csvFileInput.addEventListener('change', () => {
            // Enable process button only if a file is selected
            if (processButton) {
                processButton.disabled = !csvFileInput.files.length;
            }
        });
    }

    if (processButton) {
        processButton.addEventListener('click', handleBulkVerification);
    }
});

// =================================================================================================
// SINGLE VERIFICATION LOGIC
// =================================================================================================

async function handleSingleVerification() {
    const rawAddress = document.getElementById('rawAddress').value;
    const customerName = document.getElementById('customerName').value;
    const loadingMessage = document.getElementById('loading-message');
    const resultsContainer = document.getElementById('resultsContainer');

    if (rawAddress.trim() === "") {
        alert("Please enter a raw address to verify.");
        return;
    }

    // UI Feedback: Disable button and show loading message
    document.getElementById('verifyButton').disabled = true;
    loadingMessage.style.display = 'block';
    resultsContainer.style.display = 'none';

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: rawAddress,
                customerName: customerName
            })
        });

        const result = await response.json();

        if (response.ok && result.status === "Success") {
            displayResults(result);
        } else {
            // Handle errors from the server (e.g., JSON parsing failure, API key missing)
            alert(`Verification Failed: ${result.error || result.remarks || "Unknown error."}`);
            displayErrorResult(result);
        }

    } catch (e) {
        console.error("Fetch Error:", e);
        alert("A network error occurred. Check the console for details.");
    } finally {
        // UI Feedback: Re-enable button and hide loading message
        document.getElementById('verifyButton').disabled = false;
        loadingMessage.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
}

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


// =================================================================================================
// BULK VERIFICATION LOGIC
// =================================================================================================

/**
 * Function to download the CSV template
 */
function handleTemplateDownload() {
    const templateData = "ORDER ID,CUSTOMER NAME,CUSTOMER RAW ADDRESS\n";
    const blob = new Blob([templateData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'address_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Helper to call the Vercel API and handle basic errors.
 */
async function fetchVerification(address, name) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address, customerName: name })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return result;
        } else {
            return {
                status: "Error",
                customerCleanName: name,
                addressLine1: "API Error",
                landmark: "",
                state: "",
                district: "",
                pin: "",
                remarks: `API Failed: ${result.error || 'Unknown Server Error.'}`,
                addressQuality: "BAD"
            };
        }
    } catch (e) {
        console.error("Bulk Fetch Error:", e);
        return {
            status: "Error",
            customerCleanName: name,
            addressLine1: "Network/Timeout Error",
            landmark: "",
            state: "",
            district: "",
            pin: "",
            remarks: "Network or timeout error during API call.",
            addressQuality: "VERY BAD"
        };
    }
}

/**
 * Creates a CSV file and triggers a download.
 */
function createAndDownloadCSV(dataArray, filename) {
    const csvContent = dataArray.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', filename);
    downloadLink.style.display = 'block';
}


/**
 * Main function to handle CSV upload, batch processing, and download.
 */
async function handleBulkVerification() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a CSV file.");
        return;
    }

    const processButton = document.getElementById('processButton');
    const statusMessage = document.getElementById('status-message');
    const progressBarFill = document.getElementById('progressBarFill');
    const downloadLink = document.getElementById('downloadLink');

    // UI Setup
    processButton.disabled = true;
    fileInput.disabled = true;
    downloadLink.style.display = 'none';
    progressBarFill.style.width = '0%';
    statusMessage.textContent = "Parsing CSV...";

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        let lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length <= 1) {
            alert("CSV file is empty or contains only headers.");
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        
        // Basic header validation
        if (headers.length < 3 || headers[2] !== 'CUSTOMER RAW ADDRESS') {
            alert("Error: CSV must contain 'ORDER ID', 'CUSTOMER NAME', and 'CUSTOMER RAW ADDRESS' in the first three columns.");
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const outputData = [
            "ORDER ID", "CUSTOMER NAME", "RAW ADDRESS", 
            "CLEAN NAME", "ADDRESS LINE 1", "LANDMARK", 
            "STATE", "DISTRICT", "PIN", "REMARK", "ADDRESS QUALITY"
        ].join(',');
        let processedCount = 0;
        const totalAddresses = lines.length - 1; // Exclude header row
        const outputRows = [outputData];

        // Process addresses one by one
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            const orderId = row[0] || 'N/A';
            const customerName = row[1] || '';
            const rawAddress = row[2] || ''; 
            
            let verificationResult;
            
            if (rawAddress.trim() === "") {
                verificationResult = {
                    status: "Skipped",
                    customerCleanName: customerName,
                    addressLine1: "",
                    landmark: "",
                    state: "",
                    district: "",
                    pin: "",
                    remarks: "Skipped: Address is empty.",
                    addressQuality: "BAD"
                };
            } else {
                // Call the Vercel API
                verificationResult = await fetchVerification(rawAddress, customerName);
            }

            // Map and escape data for CSV
            const outputRow = [
                orderId,
                customerName,
                rawAddress,
                verificationResult.customerCleanName || '',
                verificationResult.addressLine1 || '',
                verificationResult.landmark || '',
                verificationResult.state || '',
                verificationResult.district || '',
                verificationResult.pin || '',
                verificationResult.remarks || '',
                verificationResult.addressQuality || ''
            ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','); // Simple CSV escaping

            outputRows.push(outputRow);
            
            // Update Progress
            processedCount++;
            const progress = (processedCount / totalAddresses) * 100;
            progressBarFill.style.width = `${progress}%`;
            statusMessage.textContent = `Processing... ${processedCount} of ${totalAddresses} addresses completed.`;
        }

        // Finalize
        statusMessage.textContent = `Processing complete! ${totalAddresses} addresses verified.`;
        createAndDownloadCSV(outputRows, "verified_addresses.csv");

    };

    reader.onerror = function() {
        alert("Error reading file.");
        processButton.disabled = false;
        fileInput.disabled = false;
    };

    reader.readAsText(file);
}
