// public/script.js

const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

document.addEventListener('DOMContentLoaded', () => {
    const verifyButton = document.getElementById('verifyButton');
    const downloadTemplateButton = document.getElementById('downloadTemplateButton');
    const csvFileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    
    // Single Address Events
    if (verifyButton) {
        verifyButton.addEventListener('click', handleSingleVerification);
    }
    
    // Bulk Address Events
    if (downloadTemplateButton) {
        downloadTemplateButton.addEventListener('click', handleTemplateDownload);
    }

    if (csvFileInput) {
        // This re-enables the file input if the access code is valid
        const accessCode = sessionStorage.getItem('bulkAccessCode');
        if (accessCode) csvFileInput.disabled = false;
        
        csvFileInput.addEventListener('change', () => {
            if (processButton) {
                // Enable process button only if a file is selected
                processButton.disabled = !csvFileInput.files.length;
            }
        });
    }

    if (processButton) {
        processButton.addEventListener('click', handleBulkVerification);
    }
});

// --- UI UTILITY FUNCTIONS ---

/**
 * Copies text content to the clipboard and gives visual feedback to the calling element.
 */
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.textContent;
        // Flash feedback
        element.textContent = '✅ Copied!';
        element.classList.remove('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
        element.classList.add('bg-secondary-green', 'text-white');
        
        setTimeout(() => {
            element.textContent = originalText;
            element.classList.remove('bg-secondary-green', 'text-white');
            element.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
        }, 1500);
    }).catch(err => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy text. Please try manually.');
    });
}

/**
 * Applies specific Tailwind styles to the remarks block based on content.
 */
function applyRemarksStyle(remarksText) {
    const remarksBlock = document.getElementById('out-remarks-block');
    const remarksContent = document.getElementById('out-remarks');
    const criticalIcon = document.getElementById('criticalIcon');

    // Return if the elements aren't present (e.g., on the bulk page)
    if (!remarksBlock || !remarksContent || !criticalIcon) return;

    // Reset classes
    remarksBlock.className = 'remarks-block p-4 rounded-xl transition-all duration-300 shadow-inner';
    remarksContent.textContent = remarksText || 'No issues found.';
    remarksContent.classList.remove('text-alert-dark', 'text-success-dark', 'font-bold');
    criticalIcon.classList.add('hidden');

    // Check for CRITICAL status or API Error
    if (remarksText && (remarksText.toUpperCase().includes('CRITICAL_ALERT') || remarksText.toUpperCase().includes('API ERROR') || remarksText.toUpperCase().includes('UNAUTHORIZED ACCESS'))) {
        // Critical Alert Style
        remarksBlock.classList.add('bg-alert-light', 'border-4', 'border-alert-border');
        remarksContent.classList.add('text-alert-dark', 'font-bold');
        criticalIcon.classList.remove('hidden');
    } else {
        // Success/Normal Style
        remarksBlock.classList.add('bg-success-light', 'border', 'border-green-300');
        remarksContent.classList.add('text-success-dark');
    }
}

/**
 * Handles the 'Copy All Results' button click on the single verification page.
 */
function handleCopyAllResults(element) {
    const name = document.getElementById('out-name').textContent;
    const address = document.getElementById('out-address').textContent;
    const landmark = document.getElementById('out-landmark').textContent;
    const district = document.getElementById('out-district').textContent;
    const state = document.getElementById('out-state').textContent;
    const pin = document.getElementById('out-pin').textContent;
    
    // Format the content to copy as a clean, multi-line address block
    const textToCopy = [
        `Name: ${name}`,
        `Address: ${address}`,
        `Landmark: ${landmark}`,
        `District: ${district}`,
        `State: ${state}`,
        `PIN: ${pin}`
    ].join('\n');

    copyToClipboard(textToCopy, element);
}

/**
 * Displays a color-coded status message for the bulk page.
 */
function updateStatusMessage(message, isError = false) {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    
    // Reset classes
    statusDiv.className = 'p-4 rounded-lg font-semibold text-center mt-6 transition-colors duration-200';

    if (isError) {
        statusDiv.classList.add('bg-red-100', 'text-danger-red', 'border', 'border-red-300');
    } else if (message.includes('complete')) {
        // Success/Complete
        statusDiv.classList.add('bg-secondary-green', 'text-white', 'shadow-lg');
    } else if (message.includes('Processing')) {
        // In Progress
        statusDiv.classList.add('bg-primary-blue', 'text-white');
    } else {
        // Initial State or Info
        statusDiv.classList.add('bg-neutral-gray', 'text-gray-700');
    }
}

// --- API FETCH FUNCTION (Handles Access Code) ---
async function fetchVerification(address, name, accessCode = null) {
    try {
        const bodyData = { address: address, customerName: name }; 
        if (accessCode) { 
            bodyData.accessCode = accessCode;
        }

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (response.status === 401) {
             return { 
                status: "Error", 
                error: "Unauthorized Access. The previously verified code is no longer valid or session expired.", 
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

        return result;

    } catch (e) {
        console.error("Fetch Error:", e);
        return { status: "Error", error: `Network/Timeout Error: ${e.message}` };
    }
}
// --- END API FETCH FUNCTION ---


// --- SINGLE VERIFICATION HANDLER (CRITICAL FIXES HERE) ---
function resetVerificationForm() {
    document.getElementById('customerName').value = '';
    document.getElementById('rawAddress').value = '';
    document.getElementById('verification-form').classList.remove('hidden'); // Show form
    document.getElementById('results-container').classList.add('hidden'); // Hide results
    document.getElementById('loading-message').classList.add('hidden');
    // Re-enable the form fields (they get disabled by handleSingleVerification)
    document.getElementById('customerName').disabled = false;
    document.getElementById('rawAddress').disabled = false;
}

async function handleSingleVerification() {
    const customerName = document.getElementById('customerName').value.trim();
    const rawAddress = document.getElementById('rawAddress').value.trim();
    const verifyButton = document.getElementById('verifyButton');
    const formContainer = document.getElementById('verification-form');
    const loadingMessage = document.getElementById('loading-message');
    const resultsContainer = document.getElementById('results-container');
    
    if (!rawAddress) {
        alert('Please enter the raw address before verifying.');
        return;
    }

    // Disable inputs and button during processing
    verifyButton.disabled = true;
    verifyButton.textContent = 'Processing...';
    document.getElementById('customerName').disabled = true;
    document.getElementById('rawAddress').disabled = true;
    
    resultsContainer.classList.add('hidden');
    loadingMessage.classList.remove('hidden'); 

    try {
        const verificationResult = await fetchVerification(rawAddress, customerName); 

        // CRITICAL FIX: The logic here ensures the results block is always shown on completion
        // and the form block is hidden, forcing the user to use the "Verify Another" button.
        
        if (verificationResult.status === "Success" || verificationResult.addressQuality !== "VERY BAD") {
            displayResults(verificationResult);
        } else {
            // Error case
            displayErrorResult(verificationResult);
            alert(`Verification Failed: ${verificationResult.error || verificationResult.remarks || "Unknown error."}`);
        }
        
        // Final UI State: Hide form, show results/error block
        formContainer.classList.add('hidden'); 
        resultsContainer.classList.remove('hidden');

    } catch (e) {
        console.error("Fetch Error:", e);
        alert("A network error occurred. Check the console for details.");
    } finally {
        verifyButton.disabled = false;
        verifyButton.textContent = 'Verify Address';
        loadingMessage.classList.add('hidden');
    }
}
// --- END SINGLE VERIFICATION HANDLER ---


// --- BULK VERIFICATION HANDLER (Using updateStatusMessage) ---
async function handleBulkVerification() {
    const fileInput = document.getElementById('csvFileInput');
    const processButton = document.getElementById('processButton');
    const progressBarFill = document.getElementById('progressBarFill');
    const downloadLink = document.getElementById('downloadLink');

    const file = fileInput.files[0];
    if (!file) {
        updateStatusMessage("⚠️ Please select a CSV file.", true);
        return;
    }

    const accessCode = sessionStorage.getItem('bulkAccessCode');
    if (!accessCode) {
        updateStatusMessage("❌ Missing access code. Please return to the home page.", true);
        return;
    }
    
    processButton.disabled = true;
    fileInput.disabled = true;
    downloadLink.classList.add('hidden'); // Use class list for hidden utility
    progressBarFill.style.width = '0%';
    updateStatusMessage("Processing... Preparing file.");
    
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            updateStatusMessage("The CSV file is empty or contains only headers.", true);
            processButton.disabled = false;
            fileInput.disabled = false;
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        if (headers.length < 3 || headers[2] !== 'CUSTOMER RAW ADDRESS') {
            updateStatusMessage("Error: CSV must contain 'ORDER ID', 'CUSTOMER NAME', and 'CUSTOMER RAW ADDRESS' in the first three columns.", true);
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
                verificationResult = await fetchVerification(rawAddress, customerName, accessCode);
            }

            // Check for unauthorized access error from the API
            if (verificationResult.error && verificationResult.error.includes("Unauthorized Access")) {
                 updateStatusMessage(`Processing failed: Unauthorized Access. Please reload the home page and enter the correct code.`, true);
                 progressBarFill.style.width = '100%';
                 processButton.disabled = false;
                 fileInput.disabled = false;
                 sessionStorage.removeItem('bulkAccessCode'); 
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
            updateStatusMessage(`Processing... ${processedCount} of ${totalAddresses} addresses completed.`);
        }

        updateStatusMessage(`Processing complete! ${totalAddresses} addresses verified. Click the download link below.`, false);
        document.getElementById('downloadLink').classList.remove('hidden'); 
        
        // Set up the download link to call the CSV creator
        document.getElementById('downloadVerifiedButton').onclick = () => {
            createAndDownloadCSV(outputRows, "verified_addresses.csv");
        };

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

// --- UTILITY FUNCTIONS (For CSV handling and Result display) ---
function handleTemplateDownload() {
    const headers = ["ORDER ID", "CUSTOMER NAME", "CUSTOMER RAW ADDRESS"];
    const exampleRow = ["ORD12345", "Rajesh Sharma", "H.No. 45, Near Axis Bank, Sector 20, Noida 201301"];
    const csvContent = [headers.join(','), exampleRow.map(c => `"${c}"`).join(',')];
    
    createAndDownloadCSV(csvContent, "bulk_verification_template.csv");
}

function createAndDownloadCSV(dataArray, filename) {
    const csvContent = dataArray.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function displayResults(data) {
    document.getElementById('out-name').textContent = data.customerCleanName || 'N/A';
    document.getElementById('out-address').textContent = data.addressLine1 || 'N/A';
    document.getElementById('out-landmark').textContent = data.landmark || 'N/A';
    document.getElementById('out-state').textContent = data.state || 'N/A';
    document.getElementById('out-district').textContent = data.district || 'N/A';
    document.getElementById('out-pin').textContent = data.pin || 'N/A';
    document.getElementById('out-quality').textContent = data.addressQuality || 'N/A';
    
    applyRemarksStyle(data.remarks || 'No issues found.');
}

function displayErrorResult(data) {
    document.getElementById('out-name').textContent = data.customerCleanName || '---';
    document.getElementById('out-address').textContent = data.addressLine1 || 'API ERROR';
    document.getElementById('out-landmark').textContent = '---';
    document.getElementById('out-state').textContent = data.state || '---';
    document.getElementById('out-district').textContent = data.district || '---';
    document.getElementById('out-pin').textContent = data.pin || '---';
    document.getElementById('out-quality').textContent = 'BAD';
    
    applyRemarksStyle(data.remarks || data.error || 'Verification failed.');
}
