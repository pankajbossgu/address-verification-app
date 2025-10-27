import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// NOTE: The actual upload logic (handleUpload) needs to be integrated with your /api/bulk-verify.js endpoint
// This component provides the professional UI structure.

const BulkUpload = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('Ready to upload.');
    const [progress, setProgress] = useState(0); // 0 to 100
    const [isLoading, setIsLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState(null);

    // Enables/disables the process button based on file selection
    useEffect(() => {
        setDownloadUrl(null); // Reset download link on file change
    }, [file]);

    const handleDownloadTemplate = () => {
        // Generates and downloads the template CSV file
        const csvContent = "ORDER ID,CUSTOMER NAME,CUSTOMER RAW ADDRESS\nORD001,John Doe,H.No. 12-345/A, near bus stand, new colony, Hyd, 500001";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "address_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const handleFileUpload = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
            setStatus(`File selected: ${selectedFile.name}`);
        } else {
            setFile(null);
            setStatus('Please select a valid CSV file.');
            alert('Invalid file type. Please upload a CSV file.');
        }
    };

    const handleProcessVerification = async () => {
        if (!file) return;

        setIsLoading(true);
        setStatus('Processing started... Please wait.');
        setProgress(0);
        setDownloadUrl(null);

        const formData = new FormData();
        formData.append('csvFile', file);

        try {
            // ⚠️ Replace with your actual Vercel API endpoint
            const response = await fetch('/api/bulk-verify', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Verification failed: ${errorText}`);
            }
            
            // Assuming the API returns the file directly as demonstrated in the previous step
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            setDownloadUrl(url);
            
            setProgress(100);
            setStatus('Verification complete! Download your results below.');
        } catch (error) {
            setStatus(`Error: ${error.message}`);
            setProgress(0);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <Head>
                <title>Bulk Address Verification | AI Verifier</title>
            </Head>

            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">
                        Bulk Address Verification 📦
                    </h1>
                    <Link href="/" className="text-blue-600 hover:text-blue-800 transition duration-150">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition">
                            ← Back to Home
                        </button>
                    </Link>
                </div>

                {/* Template Download Card */}
                <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-blue-100">
                    <h2 className="text-xl font-semibold text-blue-700 mb-3">
                        Step 1: Get the Template
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Download the official CSV template to ensure your data is structured correctly.
                    </p>
                    <button 
                        onClick={handleDownloadTemplate} 
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-md hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
                    >
                        <i className="fas fa-download mr-2"></i> Download Template (CSV)
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                        Required Columns: **ORDER ID**, **CUSTOMER NAME**, **CUSTOMER RAW ADDRESS**
                    </p>
                </div>

                {/* Upload Section Card (Drag & Drop Look) */}
                <div className="bg-white shadow-lg rounded-xl p-6 border border-green-100">
                    <h2 className="text-xl font-semibold text-green-700 mb-5">
                        Step 2: Upload & Process
                    </h2>
                    
                    <div className="border-2 border-dashed border-gray-300 bg-gray-50 p-8 rounded-lg text-center transition duration-300 hover:border-green-400">
                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 014 4v2a4 4 0 00-3.52 4H7z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 16l-3-3m0 0l-3 3m3-3v8"></path></svg>
                        <p className="mt-2 text-sm text-gray-600">
                            <label htmlFor="csv-upload" className="font-medium text-green-600 hover:text-green-500 cursor-pointer">
                                Click to upload
                            </label>
                            {' or drag and drop your file here.'}
                        </p>
                        <input 
                            id="csv-upload" 
                            type="file" 
                            accept=".csv" 
                            className="hidden" // Hide the default input, use the label above
                            onChange={handleFileUpload}
                            disabled={isLoading}
                        />
                        {file && (
                            <p className="mt-2 text-sm text-gray-800 font-semibold">
                                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                            </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            CSV files only. Max 1000 rows recommended.
                        </p>
                    </div>

                    <button 
                        onClick={handleProcessVerification}
                        disabled={!file || isLoading}
                        className={`w-full mt-6 px-6 py-3 font-semibold rounded-lg shadow-md transition duration-200 focus:outline-none focus:ring-4 ${
                            !file || isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-300'
                        }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processing...
                            </span>
                        ) : (
                            'Start Verification'
                        )}
                    </button>

                    {/* Verification Status Container */}
                    <div className="mt-8 pt-4 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Verification Status</h3>
                        
                        {/* Status Message */}
                        <p id="status-message" className={`font-semibold mb-3 ${isLoading ? 'text-blue-500' : downloadUrl ? 'text-green-600' : 'text-gray-500'}`}>
                            {status}
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                                className="h-2.5 rounded-full bg-green-500 transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>

                        {/* Download Link */}
                        {downloadUrl && (
                            <a 
                                href={downloadUrl} 
                                download="verified_addresses.csv"
                                onClick={() => setFile(null)} // Reset form after download
                                className="block w-full text-center mt-6 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition duration-200 focus:ring-4 focus:ring-red-300"
                            >
                                <i className="fas fa-file-download mr-2"></i> Download Verified CSV
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkUpload;
