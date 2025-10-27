import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

// NOTE: This SingleVerifier component replaces the need for a separate 'single.html' file.
// The implementation assumes you have the /api/single-verify endpoint working.

function SingleVerifier() {
    const [address, setAddress] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await fetch('/api/single-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Verification failed. Please check the address.');
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const outputFields = [
        { label: 'Address Line 1 (Gemini)', key: 'addressLine1' },
        { label: 'Landmark', key: 'landmark' },
        { label: 'State', key: 'state' },
        { label: 'District', key: 'district' },
        { label: 'PIN', key: 'pin' },
        { label: 'Remarks', key: 'remarks' },
        { label: 'Address Quality', key: 'addressQuality' },
    ];

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 border border-indigo-100">
            <h2 className="text-2xl font-semibold text-indigo-700 mb-4 flex items-center">
                📝 Single Address Verification
            </h2>
            
            <form onSubmit={handleSubmit} className="mb-6">
                <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Paste the customer's raw address here (House No., Street, Locality, PIN, etc.)."
                    rows="4"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none"
                    required
                />
                <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full px-6 py-3 mt-3 font-semibold rounded-lg shadow-md transition duration-200 focus:outline-none focus:ring-4 ${
                        loading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-300'
                    }`}
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Verifying...
                        </span>
                    ) : (
                        'Verify Address'
                    )}
                </button>
            </form>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg mt-4" role="alert">
                    <p className="font-bold">Verification Error</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Result Display */}
            {result && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-xl font-bold mb-4 text-green-700">Cleaned & Verified Output:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {outputFields.map(field => (
                            <div key={field.key} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm font-medium text-gray-500">{field.label}</p>
                                <p className="mt-1 text-gray-800 font-semibold break-words">
                                    {result[field.key] || 'N/A'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Home() {
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <Head>
                <title>AI Address Verification | Home</title>
            </Head>

            <div className="max-w-4xl mx-auto">
                <header className="text-center py-10">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        AI Address Verification Service 🚀
                    </h1>
                    <p className="mt-3 text-lg text-gray-600">
                        Intelligent cleaning and validation powered by **Gemini** and **India Post API**.
                    </p>
                </header>

                <main className="space-y-8">
                    {/* Single Verification Section */}
                    <SingleVerifier />
                    
                    {/* Bulk Verification Section */}
                    <div className="bg-white shadow-lg rounded-xl p-6 border border-pink-100 text-center">
                        <h2 className="text-2xl font-semibold text-pink-700 mb-4 flex items-center justify-center">
                            📦 Bulk Address Verification
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Need to process thousands of addresses? Upload a CSV and download the validated file.
                        </p>
                        <Link href="/bulk-upload" passHref>
                            <button className="w-full sm:w-auto px-6 py-3 bg-pink-600 text-white font-semibold rounded-lg shadow-md hover:bg-pink-700 transition duration-200 focus:outline-none focus:ring-4 focus:ring-pink-300">
                                Go to Bulk Upload Page
                            </button>
                        </Link>
                    </div>

                    <p className="text-center text-sm text-gray-500 pt-4">
                        API Integrations: Gemini, India Post Pin Code Lookup.
                    </p>
                </main>
            </div>
        </div>
    );
}
