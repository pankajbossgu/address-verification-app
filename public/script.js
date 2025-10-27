// This is the Vercel API endpoint copied from Step 6.
const API_ENDPOINT = "https://<YOUR-VERCEL-PROJECT-NAME>.vercel.app/api/verify-single-address"; 
// **REMEMBER TO CHANGE THIS TO YOUR ACTUAL VERCEL URL**

document.addEventListener('DOMContentLoaded', () => {
    // Logic for single.html
    const verifyButton = document.getElementById('verifyButton');
    if (verifyButton) {
        verifyButton.addEventListener('click', handleSingleVerification);
    }
    
    // Logic for bulk.html will be added in the next step
    
});

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
    document.getElementById('out-name').textContent = '---';
    document.getElementById('out-address').textContent = data.addressLine1 || 'ERROR';
    document.getElementById('out-landmark').textContent = '---';
    document.getElementById('out-state').textContent = '---';
    document.getElementById('out-district').textContent = '---';
    document.getElementById('out-pin').textContent = '---';
    document.getElementById('out-remarks').textContent = data.remarks || 'Verification failed.';
    document.getElementById('out-quality').textContent = 'BAD';
}
