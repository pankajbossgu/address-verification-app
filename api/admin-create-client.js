// api/admin-create-client.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto'); 

// Use the Service Role Key for Admin functions (high privilege)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY 
);

module.exports = async (req, res) => {
    // 1. SECURITY: Check Admin Secret Header
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized Admin Access. Invalid Secret Key.' });
    }
    
    if (req.method !== 'POST' || !req.body) {
        return res.status(405).json({ error: 'Method Not Allowed or Missing Body' });
    }
    
    // 2. Extract Data for New Client
    const { user_id, plan_limit, is_active } = req.body;
    if (!user_id || !plan_limit) {
        return res.status(400).json({ error: 'Missing user_id or plan_limit in request body.' });
    }
    
    // 3. Generate a secure, unique API Key
    const apiKey = `sk_prod_${crypto.randomBytes(16).toString('hex')}`;

    // 4. Insert client into the database
    const { data, error } = await supabase
        .from('clients')
        .insert([{ 
            user_id: user_id, 
            api_key: apiKey, 
            plan_limit: plan_limit,
            current_usage: 0,
            is_active: is_active === undefined ? true : is_active 
        }]);

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ error: 'Database Write Error', details: error.message });
    }

    // 5. Success: Return the key
    return res.status(200).json({ 
        status: 'Client Created Successfully', 
        client_id: user_id, 
        new_api_key: apiKey,
    });
};
