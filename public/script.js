// public/script.js

const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

document.addEventListener('DOMContentLoaded', () => {
    const verifyButton = document.getElementById('verifyButton');
    if (verifyButton) {
        verifyButton.addEventListener('click', handleSingleVerification);
    }
    
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    const downloadLink = document.getElementById('downloadLink'); // Ensure this is selected

    if (downloadTemplateButton) {
        downloadTemplateButton.addEventListener('click', handleTemplateDownload);
        if (csvFileInput) csvFileInput.disabled = false;
    }

    if (csvFileInput) {
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

// --- SINGLE VERIFICATION HANDLER (No Access Code Required) ---
async function handleSingleVerification() {
    const rawAddress = document.getElementById('rawAddress').value;
    const customerName = document.getElementById('customerName').value;
    const loadingMessage = document.getElementById('loading-message');
    const resultsContainer = document.getElementById('resultsContainer');

    if (rawAddress.trim() === "") {
        alert("Please enter a raw address to verify.");
        return;
    }

    document.getElementById('verifyButton').disabled = true;
    loadingMessage.style.display = 'block';
    resultsContainer.style.display = 'none';

    try {
        // NOTE: fetchVerification is called without an accessCode here
        const result = await fetchVerification(rawAddress, customerName); 

        if (result.status === "Success") {
            displayResults(result);
        } else {
            alert(`Verification Failed: ${result.error || result.remarks || "Unknown error."}`);
            displayErrorResult(result);
        }

    } catch (e) {
        console.error("Fetch Error:", e);
        alert("A network error occurred. Check the console for details.");
    } finally {
        document.getElementById('verifyButton').disabled = false;
        loadingMessage.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
}
// --- END SINGLE VERIFICATION HANDLER ---


// --- API FETCH FUNCTION (Handles Access Code) ---
async function fetchVerification(address, name, accessCode = null) {
    try {
        // Create bodyData and conditionally add accessCode
        const bodyData = { address: address, customerName: name }; 
        if (accessCode) { 
            bodyData.accessCode = accessCode; // This adds the code to the request body
        }

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData) // Use the dynamic bodyData
        });

        // Handle unauthorized error specifically
        if (response.status === 401) {
             return { 
                status: "Error", 
                error: "Unauthorized Access. Please check the bulk access code.", 
                addressQuality: "VERY BAD" 
            };
        }

        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error("Non-JSON API response. Status:", response.status);
            return { status: "Error", error: `Server Error (${response.status})` };
        }

        // Return the API result (includes success or a different error)
        return result;

    } catch (e) {
        console.error("Fetch Error:", e);
        return { status: "Error", error: `Network/Timeout Error: ${e.message}` };
    }
}
// --- END API FETCH FUNCTION ---


// --- BULK VERIFICATION HANDLER (CRITICAL CHANGE) ---
async function handleBulkVerification() {
    const fileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    const progressBarFill = document.getElementById('progressBarFill');
    const statusMessage = document.getElementById('status-message');
    const downloadLink = document.getElementById('downloadLink');

    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a CSV file.");
        return;
    }

    // ⭐ CRITICAL: PROMPT FOR ACCESS CODE IS HERE ⭐
    const accessCode = prompt("Enter Access Code for Bulk Verification:");
    if (!accessCode) {
        alert("Bulk verification cancelled. Access code is required.");
        return;
    }
    // ---------------------------------------------
    
    processButton.disabled = true;
    fileInput.disabled = true;
    downloadLink.style.display = 'none';
    statusMessage.textContent = "Processing... Preparing file.";
    progressBarFill.style.width = '0%';
    
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            alert("CSV file is empty or contains only headers.");
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        if (headers.length < 3 || headers[2] !== 'CUSTOMER RAW ADDRESS') {
            alert("Error: CSV must contain 'ORDER ID', 'CUSTOMER NAME', and 'CUSTOMER RAW ADDRESS' in the first three columns.");
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const outputData = [
            "ORDER ID", "CUSTOMER NAME", "RAW ADDRESS", "CLEAN NAME", 
            "ADDRESS LINE 1", "LANDMARK", "STATE", "DISTRICT", "PIN", 
            "REMARK", "ADDRESS QUALITY"
        ].join(',');
        const outputRows = [outputData];

        const totalAddresses = lines.length - 1;
        let processedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',').map(col => col.replace(/^"|"$/g, '').trim());
            const orderId = columns[0] || `Row-${i}`;
            const customerName = columns[1] || '';
            const rawAddress = columns[2] || '';
            let verificationResult;

            if (rawAddress.trim() === "") {
                 verificationResult = { status: "Skipped", customerCleanName: customerName, remarks: "Skipped: Address is empty.", addressQuality: "BAD" };
            } else {
                // ⭐ CRITICAL: PASS accessCode HERE ⭐
                verificationResult = await fetchVerification(rawAddress, customerName, accessCode);
            }

            // Check for unauthorized access error from the API
            if (verificationResult.error && verificationResult.error.includes("Unauthorized Access")) {
                 statusMessage.textContent = `Processing failed: Unauthorized Access. Please reload and enter the correct code.`;
                 progressBarFill.style.width = '100%';
                 processButton.disabled = false;
                 fileInput.disabled = false;
                 return; // Stop processing immediately on security error
            }

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
            ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');

            outputRows.push(outputRow);
            
            processedCount++;
            const progress = (processedCount / totalAddresses) * 100;
            progressBarFill.style.width = `${progress}%`;
            statusMessage.textContent = `Processing... ${processedCount} of ${totalAddresses} addresses completed.`;
        }

        statusMessage.textContent = `Processing complete! ${totalAddresses} addresses verified.`;
        createAndDownloadCSV(outputRows, "verified_addresses.csv");
        processButton.disabled = false;
        fileInput.disabled = false;
    };

    reader.onerror = function() {
        alert("Error reading file.");
        processButton.disabled = false;
        fileInput.disabled = false;
    };

    reader.readAsText(file);
}
// --- END BULK VERIFICATION HANDLER ---


// --- UTILITY FUNCTIONS (Condensed for brevity) ---
function handleTemplateDownload() {
    const headers = ["ORDER ID", "CUSTOMER NAME", "CUSTOMER RAW ADDRESS"];
    const exampleRow = ["ORD12345", "Rajesh Sharma", "H.No. 45, Near Axis Bank, Sector 20, Noida 201301"];
    const csvContent = headers.join(',') + "\n" + exampleRow.map(c => `"${c}"`).join(',');
    
    createAndDownloadCSV([csvContent], "bulk_verification_template.csv");
}

function createAndDownloadCSV(dataArray, filename) {
    const csvContent = dataArray.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.getElementById('downloadLink');
    if (downloadLink && downloadLink.download !== undefined) { 
        downloadLink.setAttribute('href', url);
        downloadLink.setAttribute('download', filename);
        downloadLink.style.display = 'block';
        downloadLink.click();
    } else {
        // Fallback for older browsers
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function displayResults(data) {
    // ... (Your existing display logic)
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
    // ... (Your existing error display logic)
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
