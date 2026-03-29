const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();

// CORS
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ============ DATABASE CONNECTION POOL (THIS FIXES THE TIMEOUT!) ============
const pool = mysql.createPool({
    connectionLimit: 10,
    uri: process.env.DATABASE_URL || process.env.MYSQL_URL,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database pool connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database pool!');
        connection.release();
    }
});

// Query helper using pool
function query(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// Health check
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

// API info
app.get('/api', (req, res) => {
    res.json({ message: 'Twende Tours API', status: 'running' });
});

// ============ API ROUTES ============

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    
    try {
        const [results] = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (!results || results.length === 0) return res.json({ success: false, message: 'Invalid credentials' });
        
        const user = results[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.json({ success: false, message: 'Invalid credentials' });
        if (user.role === 'staff' && !user.is_approved) return res.json({ success: false, message: 'Account pending approval' });
        
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword, role: user.role === 'manager' ? 'admin' : user.role });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, interest } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Required fields missing' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query('INSERT INTO users (name, email, password, role, phone, interest, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [name, email, hashedPassword, 'client', phone || '', interest || '', true]);
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.json({ success: false, message: 'Email already exists' });
        res.status(500).json({ error: err.message });
    }
});

// Get Fleet
app.get('/api/fleet', async (req, res) => {
    try {
        const [results] = await query('SELECT * FROM fleet ORDER BY name');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Fleet Status
app.put('/api/fleet/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    try {
        await query('UPDATE fleet SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const [results] = await query('SELECT * FROM bookings ORDER BY created_at DESC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
    const { user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount } = req.body;
    if (!user_id || !vehicle_id) return res.status(400).json({ error: 'user_id and vehicle_id required' });
    
    try {
        const [result] = await query('INSERT INTO bookings (user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending")', 
            [user_id, vehicle_id, destination, start_date, end_date, travelers || 1, notes || '', amount || 0]);
        res.json({ success: true, bookingId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Booking Status
app.put('/api/bookings/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    try {
        await query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
        if (status === 'Confirmed') {
            await query('UPDATE fleet SET status = "Booked" WHERE id = (SELECT vehicle_id FROM bookings WHERE id = ?)', [id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Users
app.get('/api/users', async (req, res) => {
    try {
        const [results] = await query('SELECT id, name, email, role, phone, interest, is_approved, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve User
app.put('/api/users/:id/approve', async (req, res) => {
    try {
        await query('UPDATE users SET is_approved = TRUE WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
    try {
        await query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Inquiries
app.get('/api/inquiries', async (req, res) => {
    try {
        const [results] = await query('SELECT * FROM inquiries ORDER BY created_at DESC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Inquiry
app.post('/api/inquiries', async (req, res) => {
    const { client_name, client_email, client_phone, destination, notes, source } = req.body;
    if (!client_name || !client_email) return res.status(400).json({ error: 'Client name and email required' });
    
    try {
        const [result] = await query('INSERT INTO inquiries (client_name, client_email, client_phone, destination, notes, source) VALUES (?, ?, ?, ?, ?, ?)', 
            [client_name, client_email, client_phone || '', destination || '', notes || '', source || 'Website']);
        res.json({ success: true, inquiryId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Inquiry
app.put('/api/inquiries/:id', async (req, res) => {
    const { status, assigned_to } = req.body;
    const { id } = req.params;
    try {
        await query('UPDATE inquiries SET status = ?, assigned_to = ?, replied_at = NOW() WHERE id = ?', [status, assigned_to || null, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ M-PESA ROUTES ============
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'm7NA2lgANcgBc0PqJP16xjxBcOZBM127jIBr3P7Sy5NF1O9r';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'MXu3cCruzCApzb1Ijaxx6tAKMWyCod85haJidC3waf2PwD6AVVnCVASzmmb3IZdJ';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://twende-tours-production.up.railway.app/api/mpesa/callback';

async function getMpesaToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    try {
        const axios = require('axios');
        const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', 
            { headers: { 'Authorization': `Basic ${auth}` }, timeout: 10000 });
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Token error:', error.message);
        return null;
    }
}

app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        if (!phone || !amount || !booking_id) return res.status(400).json({ error: 'Required fields missing' });
        
        const accessToken = await getMpesaToken();
        if (!accessToken) return res.status(500).json({ error: 'Failed to get access token' });
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        const axios = require('axios');
        const stkResponse = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline', Amount: parseInt(amount), PartyA: phone,
            PartyB: MPESA_SHORTCODE, PhoneNumber: phone, CallBackURL: MPESA_CALLBACK_URL,
            AccountReference: 'TwendeTours', TransactionDesc: `Booking ${booking_id}`
        }, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 });
        
        res.json({ success: true, checkoutRequestID: stkResponse.data.CheckoutRequestID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mpesa/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.body;
        if (!checkoutRequestID) return res.status(400).json({ error: 'checkoutRequestID required' });
        
        const accessToken = await getMpesaToken();
        if (!accessToken) return res.status(500).json({ error: 'Failed to get access token' });
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        const axios = require('axios');
        const statusResponse = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
            BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        }, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 });
        
        res.json({ success: true, status: statusResponse.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/mpesa/callback', express.json(), (req, res) => {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) return res.status(400).json({ error: 'Invalid callback' });
    
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
    const status = ResultCode === '0' ? 'Success' : 'Failed';
    
    query('UPDATE payments SET status = ?, reference = ? WHERE reference = ?', [status, ResultDesc, CheckoutRequestID])
        .catch(err => console.error('❌ Callback error:', err));
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Error handlers
process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ Server initialized successfully');
});