const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============

// CORS Configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ============ DATABASE CONNECTION POOL ============

const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'twende_tours',
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection on startup
(async () => {
    try {
        const connection = await pool.getConnection();
        await connection.execute('SELECT 1');
        console.log('✅ Connected to MySQL database pool!');
        connection.release();
    } catch (err) {
        console.error('❌ Database pool connection failed:', err.message);
    }
})();

// Query helper - FIXED: Proper promise-based query
async function query(sql, params = []) {
    const connection = await pool.getConnection();
    try {
        const [results] = await connection.execute(sql, params);
        return results;
    } finally {
        connection.release();
    }
}

// ============ INPUT VALIDATION FUNCTIONS ============

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]{7,20}$/;
    return re.test(phone);
}

function validateMpesaPhone(phone) {
    // E.164 format: +254xxxxxxxxx or 254xxxxxxxxx
    return /^(\+254|254)\d{9}$/.test(phone);
}

// ============ AUTHENTICATION MIDDLEWARE ============

async function requireAuth(req, res, next) {
    try {
        // TODO: Implement JWT verification
        // For now, just pass through
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

// ============ HEALTH CHECKS ============

app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

app.get('/api', (req, res) => {
    res.json({ message: 'Twende Tours API', status: 'running' });
});

// ============ AUTHENTICATION ROUTES ============

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    try {
        const results = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        
        if (!results || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const user = results[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        if (user.role === 'staff' && !user.is_approved) {
            return res.status(403).json({ success: false, message: 'Account pending approval' });
        }
        
        const { password: _, ...userWithoutPassword } = user;
        res.json({ 
            success: true, 
            user: userWithoutPassword, 
            role: user.role === 'manager' ? 'admin' : user.role 
        });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, interest } = req.body;
    
    // Validation
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }
    
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    
    if (phone && !validatePhone(phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone format' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
            'INSERT INTO users (name, email, password, role, phone, interest, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email.toLowerCase(), hashedPassword, 'client', phone || '', interest || '', true]
        );
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        console.error('❌ Register error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============ FLEET ROUTES ============

// Get Fleet
app.get('/api/fleet', async (req, res) => {
    try {
        const results = await query('SELECT * FROM fleet WHERE status != "Maintenance" ORDER BY name');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Fleet Status
app.put('/api/fleet/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    const validStatuses = ['Available', 'Booked', 'Maintenance', 'Repair'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    try {
        await query('UPDATE fleet SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ BOOKING ROUTES ============

// Get Bookings
app.get('/api/bookings', requireAuth, async (req, res) => {
    try {
        const results = await query('SELECT * FROM bookings ORDER BY created_at DESC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check Availability - FIXED: Added missing endpoint
app.post('/api/bookings/check-availability', async (req, res) => {
    const { vehicle_id, start_date, end_date } = req.body;
    
    if (!vehicle_id || !start_date || !end_date) {
        return res.status(400).json({ available: false, reason: 'Missing required fields' });
    }
    
    try {
        const results = await query(
            'SELECT COUNT(*) as count FROM bookings WHERE vehicle_id = ? AND status != "Cancelled" AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))',
            [vehicle_id, end_date, start_date, end_date, start_date]
        );
        
        const isBooked = results[0].count > 0;
        res.json({ available: !isBooked, reason: isBooked ? 'Vehicle not available' : 'Vehicle available' });
    } catch (err) {
        console.error('❌ Check availability error:', err);
        res.status(500).json({ available: false, reason: 'Server error' });
    }
});

// Create Booking
app.post('/api/bookings', requireAuth, async (req, res) => {
    const { user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount } = req.body;
    
    if (!user_id || !vehicle_id) {
        return res.status(400).json({ error: 'user_id and vehicle_id required' });
    }
    
    if (!Number.isInteger(travelers) || travelers < 1) {
        return res.status(400).json({ error: 'Valid number of travelers required' });
    }
    
    if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'Valid amount required' });
    }
    
    try {
        const results = await query(
            'INSERT INTO bookings (user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, vehicle_id, destination, start_date, end_date, travelers || 1, notes || '', amount || 0, 'Pending']
        );
        res.json({ success: true, bookingId: results.insertId });
    } catch (err) {
        console.error('❌ Create booking error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Booking Status - FIXED: With transaction handling
app.put('/api/bookings/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        await connection.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
        
        if (status === 'Confirmed') {
            await connection.execute(
                'UPDATE fleet SET status = "Booked" WHERE id = (SELECT vehicle_id FROM bookings WHERE id = ?)',
                [id]
            );
        } else if (status === 'Cancelled' || status === 'Completed') {
            await connection.execute(
                'UPDATE fleet SET status = "Available" WHERE id = (SELECT vehicle_id FROM bookings WHERE id = ?)',
                [id]
            );
        }
        
        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error('❌ Update booking status error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// ============ USER MANAGEMENT ROUTES ============

// Get Users
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const results = await query(
            'SELECT id, name, email, role, phone, interest, is_approved, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve User
app.put('/api/users/:id/approve', requireAuth, async (req, res) => {
    try {
        await query('UPDATE users SET is_approved = TRUE WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
app.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
        await query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ INQUIRY ROUTES ============

// Get Inquiries
app.get('/api/inquiries', requireAuth, async (req, res) => {
    try {
        const results = await query('SELECT * FROM inquiries ORDER BY created_at DESC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Inquiry
app.post('/api/inquiries', async (req, res) => {
    const { client_name, client_email, client_phone, destination, notes, source } = req.body;
    
    if (!client_name || !client_email) {
        return res.status(400).json({ error: 'Client name and email required' });
    }
    
    if (!validateEmail(client_email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    try {
        const results = await query(
            'INSERT INTO inquiries (client_name, client_email, client_phone, destination, notes, source) VALUES (?, ?, ?, ?, ?, ?)',
            [client_name, client_email.toLowerCase(), client_phone || '', destination || '', notes || '', source || 'Website']
        );
        res.json({ success: true, inquiryId: results.insertId });
    } catch (err) {
        console.error('❌ Create inquiry error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update Inquiry
app.put('/api/inquiries/:id', requireAuth, async (req, res) => {
    const { status, assigned_to } = req.body;
    const { id } = req.params;
    
    const validStatuses = ['NO ACTION', 'Replied', 'Converted'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    try {
        await query(
            'UPDATE inquiries SET status = ?, assigned_to = ?, replied_at = NOW() WHERE id = ?',
            [status, assigned_to || null, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ M-PESA PAYMENT ROUTES ============

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';

// Validate M-Pesa credentials
if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
    console.warn('⚠️  M-Pesa credentials not configured. Payment functionality disabled.');
}

async function getMpesaToken() {
    if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) return null;
    
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const baseUrl = MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    
    try {
        const response = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { 'Authorization': `Basic ${auth}` },
            timeout: 10000
        });
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Token error:', error.message);
        return null;
    }
}

// STK Push for M-Pesa
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        
        if (!phone || !amount || !booking_id) {
            return res.status(400).json({ error: 'Required fields missing' });
        }
        
        if (!validateMpesaPhone(phone)) {
            return res.status(400).json({ error: 'Invalid phone format (use +254xxxxxxxxx)' });
        }
        
        if (!Number.isFinite(amount) || amount < 10) {
            return res.status(400).json({ error: 'Amount must be at least 10 KES' });
        }
        
        const accessToken = await getMpesaToken();
        if (!accessToken) return res.status(500).json({ error: 'Failed to get access token' });
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        const baseUrl = MPESA_ENV === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        
        const stkResponse = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
            BusinessShortCode: MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: parseInt(amount),
            PartyA: phone,
            PartyB: MPESA_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: MPESA_CALLBACK_URL,
            AccountReference: 'TwendeTours',
            TransactionDesc: `Booking ${booking_id}`
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        
        res.json({ success: true, checkoutRequestID: stkResponse.data.CheckoutRequestID });
    } catch (error) {
        console.error('❌ STK Push error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Check M-Pesa Payment Status
app.post('/api/mpesa/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.body;
        if (!checkoutRequestID) return res.status(400).json({ error: 'checkoutRequestID required' });
        
        const accessToken = await getMpesaToken();
        if (!accessToken) return res.status(500).json({ error: 'Failed to get access token' });
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        const baseUrl = MPESA_ENV === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        
        const statusResponse = await axios.post(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
            BusinessShortCode: MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        
        res.json({ success: true, status: statusResponse.data });
    } catch (error) {
        console.error('❌ Check status error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// M-Pesa Callback Handler - FIXED: Proper error handling
app.post('/api/mpesa/callback', express.json(), async (req, res) => {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
        return res.status(400).json({ error: 'Invalid callback' });
    }
    
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
    const status = ResultCode === 0 ? 'Success' : 'Failed';
    
    try {
        await query(
            'UPDATE payments SET status = ?, reference = ? WHERE reference = ?',
            [status, ResultDesc, CheckoutRequestID]
        );
        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (err) {
        console.error('❌ Callback error:', err);
        // Still return success to M-Pesa to prevent retries
        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
});

// ============ ERROR HANDLERS ============

app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ Server initialized successfully');
});
