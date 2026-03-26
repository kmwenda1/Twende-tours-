const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();

// ============ CORS CONFIGURATION ============
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// ============ DATABASE CONNECTION ============
let db;

function connectDatabase() {
    const dbConfig = process.env.DATABASE_URL || process.env.MYSQL_URL 
        ? { uri: process.env.DATABASE_URL || process.env.MYSQL_URL }
        : {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'twende_tours',
            port: process.env.DB_PORT || 3306
        };
    
    db = mysql.createConnection(dbConfig);
    
    db.connect((err) => {
        if (err) {
            console.error('❌ Database connection failed:', err.message);
            setTimeout(connectDatabase, 5000);
        } else {
            console.log('✅ Connected to MySQL database!');
        }
    });
    
    db.on('error', (err) => {
        console.error('❌ MySQL error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 Reconnecting to database...');
            connectDatabase();
        }
    });
}

connectDatabase();

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) {
            return res.status(503).json({ 
                status: 'error', 
                database: 'disconnected',
                error: err.message 
            });
        }
        res.json({ status: 'ok', database: 'connected' });
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Twende Tours API',
        status: 'running',
        endpoints: ['/api/fleet', '/api/login', '/api/bookings', '/health']
    });
});

// ============ API ROUTES ============

// Login - FIXED: Direct database query without state check
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    console.log('🔐 Login attempt:', email);
    
    // ✅ FIXED: Direct query without state check
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('❌ Login DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        
        const user = results[0];
        
        try {
            const isValid = await bcrypt.compare(password, user.password);
            
            if (!isValid) {
                return res.json({ success: false, message: 'Invalid credentials' });
            }
            if (user.role === 'staff' && !user.is_approved) {
                return res.json({ success: false, message: 'Account pending approval' });
            }
            
            const { password: _, ...userWithoutPassword } = user;
            
            console.log('✅ Login successful:', user.email);
            res.json({ 
                success: true, 
                user: userWithoutPassword, 
                role: user.role === 'manager' ? 'admin' : user.role 
            });
        } catch (bcryptErr) {
            console.error('❌ Bcrypt error:', bcryptErr);
            return res.status(500).json({ error: 'Authentication error' });
        }
    });
});

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password, phone, interest } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('❌ Hash error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query(
            'INSERT INTO users (name, email, password, role, phone, interest, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, 'client', phone || '', interest || '', true],
            (err, result) => {
                if (err) {
                    console.error('❌ Register DB error:', err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.json({ success: false, message: 'Email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                console.log('✅ Registration successful:', email);
                res.json({ success: true, message: 'Registration successful', userId: result.insertId });
            }
        );
    });
});

// Get Fleet
app.get('/api/fleet', (req, res) => {
    console.log('🚗 Fleet request received');
    db.query('SELECT * FROM fleet ORDER BY name', (err, results) => {
        if (err) {
            console.error('❌ Fleet DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true,  results });
    });
});

// Update Fleet Status
app.put('/api/fleet/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }
    
    db.query('UPDATE fleet SET status = ? WHERE id = ?', [status, id], (err, result) => {
        if (err) {
            console.error('❌ Update fleet error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json({ success: true, message: 'Fleet status updated' });
    });
});

// Get Bookings
app.get('/api/bookings', (req, res) => {
    console.log('📋 Bookings request received');
    db.query('SELECT * FROM bookings ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error('❌ Bookings DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true,  results });
    });
});

// Check Availability
app.post('/api/bookings/check-availability', (req, res) => {
    const { vehicle_id, start_date, end_date } = req.body;
    
    if (!vehicle_id || !start_date || !end_date) {
        return res.status(400).json({ success: false, error: 'vehicle_id, start_date, and end_date are required' });
    }
    
    db.query(
        `SELECT * FROM bookings WHERE vehicle_id = ? AND status IN ('Pending', 'Confirmed') 
         AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))`,
        [vehicle_id, start_date, end_date, start_date, end_date],
        (err, results) => {
            if (err) {
                console.error('❌ Availability error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, available: results.length === 0 });
        }
    );
});

// Create Booking
app.post('/api/bookings', (req, res) => {
    const { user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount } = req.body;
    
    console.log('📥 Creating booking:', { user_id, vehicle_id, destination, amount });
    
    if (!user_id || !vehicle_id) {
        return res.status(400).json({ error: 'user_id and vehicle_id are required' });
    }
    
    db.query(
        'INSERT INTO bookings (user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending")',
        [user_id, vehicle_id, destination, start_date, end_date, travelers || 1, notes || '', amount || 0],
        (err, result) => {
            if (err) {
                console.error('❌ Booking DB error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('✅ Booking created:', result.insertId);
            res.json({ success: true, bookingId: result.insertId });
        }
    );
});

// Update Booking Status
app.put('/api/bookings/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) {
            console.error('❌ Update booking error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'Booking status updated' });
    });
});

// Get Users
app.get('/api/users', (req, res) => {
    db.query('SELECT id, name, email, role, phone, interest, is_approved, created_at FROM users', (err, results) => {
        if (err) {
            console.error('❌ Users DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true,  results });
    });
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
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { 'Authorization': `Basic ${auth}` }, timeout: 10000 }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Token error:', error.message);
        return null;
    }
}

app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        
        if (!phone || !amount || !booking_id) {
            return res.status(400).json({ error: 'phone, amount, and booking_id are required' });
        }
        
        const accessToken = await getMpesaToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Failed to get access token' });
        }
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        const axios = require('axios');
        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
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
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        
        res.json({
            success: true,
            message: 'STK Push sent successfully',
            checkoutRequestID: stkResponse.data.CheckoutRequestID
        });
        
    } catch (error) {
        console.error('❌ STK Push error:', error.response?.data || error.message);
        res.status(500).json({ error: 'STK Push failed', details: error.response?.data || error.message });
    }
});

// ============ ERROR HANDLERS ============

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ Server initialized successfully');
});