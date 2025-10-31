// public/script.js

// The API endpoint for the serverless function
const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

document.addEventListener('DOMContentLoaded', () => {
    // Check for bulk page elements
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');

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

/**
 * Executes a verification request to the serverless function.
 * This is used by the bulk verification logic.
 * @param {string} rawAddress - The raw address string.
 * @param {string} customerName - The customer name (kept for bulk CSV consistency, but ignored by the API now).
 * @returns {Promise<Object>} The verification result object.
 */
async function fetchVerification(rawAddress, customerName = "") {
    const payload = {
        rawAddress: rawAddress,
        customerName: customerName // Still sent for bulk consistency, but API will ignore it for cleaning
    };

    // Implements simple exponential backoff for resilience
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Server returned error status: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed: ${error.message}`);
            if (attempt === 2) throw error; // Re-throw on final failure
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


function handleTemplateDownload() {
    createAndDownloadCSV(
        ["Order ID", "Customer Name", "Raw Address"], 
        "address_verification_template.csv", 
        false, // Do not include existing content
        ["1001","John Doe","123 Main Street, Anytown, CA 90210"],
        ["1002","Jane Smith","456 Oak Ave, Otherville, NY 10001"]
    );
}

// Helper to create and download the CSV
function createAndDownloadCSV(outputRows, filename, isBulk = true, ...sampleRows) {
    const header = isBulk 
        ? "Order ID,Customer Name,Raw Address,Cleaned Name,Cleaned Address Line,Landmark,State,District,Pin,Remarks,Address Quality\n"
        : outputRows.join(','); // Only used for template in non-bulk mode

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (isBulk) {
        csvContent += header;
        outputRows.forEach(row => {
            csvContent += row + "\n";
        });
    } else {
        // Template case
        csvContent += outputRows.join(',') + "\n";
        sampleRows.forEach(rowArray => {
             csvContent += rowArray.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + "\n";
        });
    }


    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- Bulk Verification Logic ---

// Helper function to update bulk status message (Duplicated in bulk.html for canvas, kept here for robustness)
function updateStatusMessage(message, isError = false) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `mt-4 p-3 rounded-lg text-center font-semibold transition duration-300 ${isError ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`;
    }
}

async function handleBulkVerification() {
    const fileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    const progressBarFill = document.getElementById('progressBarFill');
    const file = fileInput.files[0];

    if (!file) {
        updateStatusMessage("Please select a CSV file.", true);
        return;
    }

    processButton.disabled = true;
    fileInput.disabled = true;
    progressBarFill.style.width = '0%';
    updateStatusMessage('Starting file read...', false);

    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        // Split by newline and remove header (first row)
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1) {
            updateStatusMessage("CSV file is empty or only contains a header.", true);
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const dataRows = lines.slice(1);
        const totalAddresses = dataRows.length;
        let processedCount = 0;
        let outputRows = [];

        // Prepare a robust regex for parsing CSV row, handling quotes
        const csvRegex = /("([^"]*)"|[^,]+)/g;

        for (const line of dataRows) {
            // Robustly extract columns using the regex
            const columns = [...line.matchAll(csvRegex)].map(match => {
                // If it was a quoted string, remove the quotes and un-escape double-quotes
                let value = match[1];
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1).replace(/""/g, '"');
                }
                return value.trim();
            });

            // Assuming the template format: [0] Order ID, [1] Customer Name, [2] Raw Address
            const orderId = columns[0] || 'N/A';
            const customerName = columns[1] || ''; // Customer Name is still read from CSV
            const rawAddress = columns[2] || '';

            if (rawAddress === '') {
                // Skip rows with no address, but still output them with N/A fields
                const outputRow = [
                    orderId, customerName, rawAddress, '', '', '', '', '', '', 'Skipped: Empty Raw Address', 'Low'
                ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
                outputRows.push(outputRow);
            } else {
                let verificationResult;
                try {
                    // Call the common fetch function
                    verificationResult = await fetchVerification(rawAddress, customerName);
                } catch (e) {
                    verificationResult = {
                        customerCleanName: '',
                        addressLine1: '',
                        landmark: '',
                        state: '',
                        district: '',
                        pin: '',
                        remarks: `API Error: ${e.message}`,
                        addressQuality: 'Low'
                    };
                }

                // NOTE: customerCleanName will be empty as the API no longer generates it
                const outputRow = [
                    orderId,
                    customerName, // Keep raw name
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
            }
            
            processedCount++;
            const progress = (processedCount / totalAddresses) * 100;
            progressBarFill.style.width = `${progress}%`;
            updateStatusMessage(`Processing... ${processedCount} of ${totalAddresses} addresses completed.`, false);
        }

        updateStatusMessage(`Processing complete! ${totalAddresses} addresses verified. Click 'Download Verified CSV'.`, false);
        createAndDownloadCSV(outputRows, "verified_addresses.csv");
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
