// =================================================================================================
// BULK VERIFICATION LOGIC
// =================================================================================================

// Function to download the CSV template
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

// Attach listeners specifically for bulk.html elements
document.addEventListener('DOMContentLoaded', () => {
    // ... existing single verification setup ...

    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');

    if (downloadTemplateButton) {
        downloadTemplateButton.addEventListener('click', handleTemplateDownload);
        csvFileInput.disabled = false; // Enable input once template is available
    }

    if (csvFileInput) {
        csvFileInput.addEventListener('change', () => {
            // Enable process button only if a file is selected
            processButton.disabled = !csvFileInput.files.length;
        });
    }

    if (processButton) {
        processButton.addEventListener('click', handleBulkVerification);
    }
});

/**
 * Main function to handle CSV upload, batch processing, and download.
 */
async function handleBulkVerification() {
    const file = document.getElementById('csvFileInput').files[0];
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
            return;
        }

        const headers = lines[0].split(',');
        // Validate required headers
        if (headers[2].trim().toUpperCase() !== 'CUSTOMER RAW ADDRESS') {
            alert("Error: 'CUSTOMER RAW ADDRESS' column not found or is in the wrong position (should be C1).");
            processButton.disabled = false;
            return;
        }

        const outputData = [
            "ORDER ID", "CUSTOMER NAME", "RAW ADDRESS", 
            "CLEAN NAME", "ADDRESS LINE 1", "LANDMARK", 
            "STATE", "DISTRICT", "PIN", "REMARK", "ADDRESS QUALITY"
        ];
        let processedCount = 0;
        const totalAddresses = lines.length - 1; // Exclude header row

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

            outputData.push(outputRow);
            
            // Update Progress
            processedCount++;
            const progress = (processedCount / totalAddresses) * 100;
            progressBarFill.style.width = `${progress}%`;
            statusMessage.textContent = `Processing... ${processedCount} of ${totalAddresses} addresses completed.`;
        }

        // Finalize
        statusMessage.textContent = `Processing complete! ${totalAddresses} addresses verified.`;
        createAndDownloadCSV(outputData, "verified_addresses.csv");

    };

    reader.onerror = function() {
        alert("Error reading file.");
    };

    reader.readAsText(file);
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

    // Optional: Auto-click the link if supported (for immediate download)
    // downloadLink.click();
}
