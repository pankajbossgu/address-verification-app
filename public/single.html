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
    const downloadLink = document.getElementById('downloadLink');

    if (downloadTemplateButton) {
        // Renamed function to use the one in bulk.html
        // The script.js now just holds the common functions
    }

    if (csvFileInput) {
        // Event listener for file selection - handles disabling/enabling the process button
        csvFileInput.addEventListener('change', () => {
            if (processButton) {
                // Enable process button only if a file is selected
                processButton.disabled = !csvFileInput.files.length;
            }
        });
    }

    // No change here - the bulk handler logic is self-contained in bulk.html for simplicity
});

// --- COMMON UI UTILITY FUNCTIONS ---

/**
 * Copies text content to the clipboard and gives visual feedback to the calling element.
 * @param {string} text - The text to copy.
 * @param {HTMLElement} element - The button/element that was clicked.
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
 * A simple utility function for creating and downloading CSV.
 * (Moved from bulk.html for cleaner code, although bulk.html still handles the main logic.)
 */
function createAndDownloadCSV(rows, filename) {
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Fallback for older browsers
    if (navigator.msSaveBlob) { 
        navigator.msSaveBlob(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// --- END COMMON UTILITY FUNCTIONS ---
