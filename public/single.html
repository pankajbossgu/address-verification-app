<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Single Address Verification</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'primary-blue': '#1D4ED8', // Dark Blue
                        'secondary-green': '#059669', // Dark Green
                        'neutral-gray': '#E5E7EB',
                        'success-light': '#D1FAE5',
                        'success-dark': '#065F46',
                        'alert-light': '#FEE2E2', // Red-100
                        'alert-dark': '#991B1B', // Red-800
                        'yellow-100': '#FEF3C7',
                        'yellow-800': '#92400E',
                        'yellow-300': '#FCD34D',
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
        /* Style for the remarks block to ensure it's easily targetable for the alert class */
        .remarks-block {
            transition: all 0.3s ease;
        }
    </style>
</head>
<body class="bg-neutral-gray min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-2xl bg-white p-8 sm:p-10 rounded-xl shadow-2xl border border-gray-100">

        <a href="index.html" class="text-primary-blue hover:text-blue-700 font-medium mb-6 inline-flex items-center transition duration-150">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Home
        </a>

        <header class="text-center mb-8">
            <h1 class="text-3xl font-extrabold text-gray-900">
                Verify Single Address
            </h1>
            <p class="text-md text-gray-500 mt-2">Enter a raw address below to clean, normalize, and verify its geographic details.</p>
        </header>
        
        <div class="space-y-6">
            
            <div>
                <label for="rawAddress" class="block text-lg font-semibold text-gray-700 mb-2">Raw Address</label>
                <textarea id="rawAddress" rows="4" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue transition duration-150 shadow-sm" placeholder="Enter the full, uncleaned address here..."></textarea>
            </div>

            <button id="verifyButton" class="w-full py-3 px-4 bg-secondary-green text-white font-bold text-lg rounded-lg shadow-md transition duration-300 transform hover:scale-[1.01] hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-secondary-green focus:ring-opacity-50">
                Verify Address
            </button>
        </div>

        <div id="loading-message" class="hidden mt-8 p-4 text-center rounded-lg bg-yellow-100 text-yellow-800 font-medium transition duration-300 shadow-inner">
            Processing... Please wait.
        </div>

        <div id="resultsContainer" class="mt-8 pt-6 border-t border-gray-200 hidden">
            <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Verification Results</h2>

            <div id="remarks-block" class="remarks-block p-4 mb-6 rounded-lg shadow-md text-sm font-medium transition duration-300 ease-in-out bg-success-light text-success-dark">
                <p id="out-remarks"></p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">Cleaned Address Line</p>
                    <div class="flex justify-between items-center mt-1">
                        <span id="out-address" class="text-gray-800 font-medium truncate">N/A</span>
                        <button onclick="copyToClipboard('out-address', this)" class="text-primary-blue hover:text-blue-700 text-sm ml-2 p-1 rounded transition duration-150">Copy</button>
                    </div>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">Landmark</p>
                    <div class="flex justify-between items-center mt-1">
                        <span id="out-landmark" class="text-gray-800 font-medium truncate">N/A</span>
                        <button onclick="copyToClipboard('out-landmark', this)" class="text-primary-blue hover:text-blue-700 text-sm ml-2 p-1 rounded transition duration-150">Copy</button>
                    </div>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">Pincode (PIN)</p>
                    <div class="flex justify-between items-center mt-1">
                        <span id="out-pin" class="text-gray-800 font-medium truncate">N/A</span>
                        <button onclick="copyToClipboard('out-pin', this)" class="text-primary-blue hover:text-blue-700 text-sm ml-2 p-1 rounded transition duration-150">Copy</button>
                    </div>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">District</p>
                    <span id="out-district" class="text-gray-800 font-medium mt-1 block truncate">N/A</span>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">State</p>
                    <span id="out-state" class="text-gray-800 font-medium mt-1 block truncate">N/A</span>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="text-xs font-semibold uppercase text-gray-500">Address Quality</p>
                    <span id="out-quality" class="text-gray-800 font-medium mt-1 block truncate">N/A</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // The API endpoint for the serverless function
        const API_ENDPOINT = "https://address-verification-app.vercel.app/api/verify-single-address";

        document.addEventListener('DOMContentLoaded', () => {
            const verifyButton = document.getElementById('verifyButton');
            if (verifyButton) {
                verifyButton.addEventListener('click', handleSingleVerification);
            }
        });

        // Custom helper functions
        function showMessage(elementId, message, isError = false) {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.textContent = message;
            el.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-yellow-100', 'text-yellow-800');
            el.classList.add(isError ? 'bg-red-100' : 'bg-yellow-100', isError ? 'text-red-800' : 'text-yellow-800');
        }

        function applyRemarksStyle(remarks) {
            const remarksBlock = document.getElementById('remarks-block');
            const remarksText = document.getElementById('out-remarks');
            const remarksContent = remarks || 'Address verified successfully with high confidence.';

            remarksText.textContent = remarksContent;

            remarksBlock.classList.remove('bg-success-light', 'text-success-dark', 'bg-alert-light', 'text-alert-dark', 'bg-yellow-100', 'text-yellow-800');

            // If remarks indicate a critical issue (e.g., major correction or failure), apply alert style
            if (remarksContent.toLowerCase().includes('no pincode found') || remarksContent.toLowerCase().includes('could not be parsed') || remarksContent.toLowerCase().includes('was significantly corrected')) {
                remarksBlock.classList.add('bg-alert-light', 'text-alert-dark');
            } else if (remarksContent.toLowerCase().includes('warning')) {
                // For general warnings (e.g., Post Office verification failed)
                 remarksBlock.classList.add('bg-yellow-100', 'text-yellow-800');
            } else {
                remarksBlock.classList.add('bg-success-light', 'text-success-dark');
            }
        }

        function copyToClipboard(elementId, button) {
            const element = document.getElementById(elementId);
            const text = element.textContent;

            // Use document.execCommand('copy') for compatibility in iFrame environments
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.remove('text-primary-blue', 'hover:text-blue-700');
                button.classList.add('text-secondary-green');

                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('text-secondary-green');
                    button.classList.add('text-primary-blue', 'hover:text-blue-700');
                }, 1500);

            } catch (err) {
                console.error('Could not copy text: ', err);
            }
        }

        async function handleSingleVerification() {
            const rawAddress = document.getElementById('rawAddress').value;
            const loadingMessage = document.getElementById('loading-message');
            const resultsContainer = document.getElementById('resultsContainer');
            const verifyButton = document.getElementById('verifyButton');
            
            // Validation check (now for only rawAddress)
            if (rawAddress.trim() === "") {
                showMessage('loading-message', "Please enter a raw address to verify.", true);
                loadingMessage.classList.remove('hidden');
                resultsContainer.classList.add('hidden');
                return;
            }

            loadingMessage.classList.remove('hidden');
            resultsContainer.classList.add('hidden');
            showMessage('loading-message', 'Processing... Please wait.', false);
            
            verifyButton.disabled = true;
            verifyButton.textContent = 'Verifying...';

            try {
                // Pass an empty customerName to the API, which will ignore it
                const verificationResult = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rawAddress: rawAddress, customerName: "" })
                }).then(res => {
                    if (!res.ok) {
                        return res.json().then(error => {
                            throw new Error(error.error || `Server returned error status: ${res.status}`);
                        });
                    }
                    return res.json();
                });

                // Check for server error status in the response body
                if (verificationResult.status === "Error") {
                    throw new Error(verificationResult.error);
                }

                showMessage('loading-message', 'Verification successful!', false);
                loadingMessage.classList.add('hidden');
                resultsContainer.classList.remove('hidden');

                // Populate results (Note: out-name field is removed from HTML)
                document.getElementById('out-address').textContent = verificationResult.addressLine1 || 'N/A';
                document.getElementById('out-landmark').textContent = verificationResult.landmark || 'N/A';
                document.getElementById('out-district').textContent = verificationResult.district || 'N/A';
                document.getElementById('out-state').textContent = verificationResult.state || 'N/A';
                document.getElementById('out-pin').textContent = verificationResult.pin || 'N/A';
                document.getElementById('out-quality').textContent = verificationResult.addressQuality || 'N/A';
                
                // Apply the new styling logic for remarks
                applyRemarksStyle(verificationResult.remarks);
                
            } catch (e) {
                showMessage('loading-message', `Verification failed: ${e.message}`, true);
                loadingMessage.classList.remove('hidden'); 
                resultsContainer.classList.add('hidden');
            } finally {
                verifyButton.disabled = false;
                verifyButton.textContent = 'Verify Address';
            }
        }
    </script>
</body>
</html>
