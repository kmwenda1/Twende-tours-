const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();

// ============ CORS CONFIGURATION (Allow Vercel Frontend) ============
const corsOptions = {
    origin: [
        'https://twende-tours.vercel.app',
        'https://twende-tours-*.vercel.app',  // Wildcard for preview deployments
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// ============ DATABASE CONNECTION POOL (Production Ready) ============
const db = mysql.createPool({
    connectionLimit: 10,
    uri: process.env.DATABASE_URL || process.env.MYSQL_URL,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'twende_tours',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    queueLimit: 0
});

// Test database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database pool!');
        connection.release();
    }
});

// ============ HEALTH CHECK ENDPOINTS (Required for Railway) ============
app.get('/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) {
            return res.status(503).json({ 
                status: 'error', 
                timestamp: new Date().toISOString(),
                database: 'disconnected',
                error: err.message 
            });
        }
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: 'connected',
            uptime: process.uptime()
        });
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Twende Tours API',
        version: '1.0.0',
        status: 'running',
        endpoints: [
            '/api/fleet',
            '/api/login', 
            '/api/register',
            '/api/bookings',
            '/api/users',
            '/api/inquiries',
            '/api/mpesa/stkpush',
            '/health'
        ]
    });
});

// ============ API ROUTES ============

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    console.log('🔐 Login attempt:', email);
    
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
            
            // Remove password from response
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
    
    console.log('📝 Registration attempt:', email);
    
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
        res.json({ success: true, data: results });
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
    db.query(
        `SELECT b.*, f.name as vehicle_name, f.type as vehicle_type, u.name as client_name, u.email as client_email 
         FROM bookings b 
         LEFT JOIN fleet f ON b.vehicle_id = f.id 
         LEFT JOIN users u ON b.user_id = u.id 
         ORDER BY b.created_at DESC`,
        (err, results) => {
            if (err) {
                console.error('❌ Bookings DB error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, data: results });
        }
    );
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
    
    // Validate required fields
    if (!user_id || !vehicle_id || !destination || !start_date || !end_date) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['user_id', 'vehicle_id', 'destination', 'start_date', 'end_date']
        });
    }
    
    db.query(
        'INSERT INTO bookings (user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending")',
        [user_id, vehicle_id, destination, start_date, end_date, travelers || 1, notes || '', amount || 0],
        (err, result) => {
            if (err) {
                console.error('❌ Booking DB error:', err);
                if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                    return res.status(400).json({ 
                        error: 'User or vehicle not found',
                        message: 'Please verify the user_id and vehicle_id exist'
                    });
                }
                return res.status(500).json({ 
                    error: err.message, 
                    sqlError: err.sqlMessage,
                    message: 'Failed to create booking'
                });
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
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }
    
    console.log('🔄 Updating booking status:', id, status);
    
    db.query(
        'UPDATE bookings SET status = ? WHERE id = ?',
        [status, id],
        (err, result) => {
            if (err) {
                console.error('❌ Update booking error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            
            // If status is Confirmed, also update fleet status to Booked
            if (status === 'Confirmed') {
                db.query(
                    'UPDATE fleet SET status = "Booked" WHERE id = (SELECT vehicle_id FROM bookings WHERE id = ?)',
                    [id],
                    (fleetErr) => {
                        if (fleetErr) console.error('❌ Fleet update error:', fleetErr);
                    }
                );
            }
            
            res.json({ success: true, message: 'Booking status updated' });
        }
    );
});

// Get Users
app.get('/api/users', (req, res) => {
    db.query('SELECT id, name, email, role, phone, interest, is_approved, created_at FROM users ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error('❌ Users DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Approve User
app.put('/api/users/:id/approve', (req, res) => {
    db.query('UPDATE users SET is_approved = TRUE WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            console.error('❌ Approve user error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, message: 'User approved' });
    });
});

// Delete User
app.delete('/api/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            console.error('❌ Delete user error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted' });
    });
});

// Get Inquiries
app.get('/api/inquiries', (req, res) => {
    db.query('SELECT * FROM inquiries ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error('❌ Inquiries DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Create Inquiry
app.post('/api/inquiries', (req, res) => {
    const { client_name, client_email, client_phone, destination, notes, source } = req.body;
    
    if (!client_name || !client_email) {
        return res.status(400).json({ error: 'Client name and email are required' });
    }
    
    db.query(
        'INSERT INTO inquiries (client_name, client_email, client_phone, destination, notes, source) VALUES (?, ?, ?, ?, ?, ?)',
        [client_name, client_email, client_phone || '', destination || '', notes || '', source || 'Website'],
        (err, result) => {
            if (err) {
                console.error('❌ Inquiry DB error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, inquiryId: result.insertId });
        }
    );
});

// Update Inquiry Status
app.put('/api/inquiries/:id', (req, res) => {
    const { status, assigned_to } = req.body;
    const { id } = req.params;
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }
    
    db.query(
        'UPDATE inquiries SET status = ?, assigned_to = ?, replied_at = NOW() WHERE id = ?',
        [status, assigned_to || null, id],
        (err, result) => {
            if (err) {
                console.error('❌ Update inquiry error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }
            res.json({ success: true, message: 'Inquiry updated' });
        }
    );
});

// ============ M-PESA ROUTES ============

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'm7NA2lgANcgBc0PqJP16xjxBcOZBM127jIBr3P7Sy5NF1O9r';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'MXu3cCruzCApzb1Ijaxx6tAKMWyCod85haJidC3waf2PwD6AVVnCVASzmmb3IZdJ';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://twende-tours-production.up.railway.app/api/mpesa/callback';

// Generate M-Pesa Access Token
async function getMpesaToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    try {
        const axios = require('axios');
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { 
                headers: { 'Authorization': `Basic ${auth}` },
                timeout: 10000
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Token error:', error.message);
        return null;
    }
}

// STK Push (Lipa Na M-Pesa Online)
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        
        if (!phone || !amount || !booking_id) {
            return res.status(400).json({ error: 'phone, amount, and booking_id are required' });
        }
        
        console.log('💰 M-Pesa STK Push:', phone, amount, booking_id);
        
        const accessToken = await getMpesaToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Failed to get M-Pesa access token' });
        }
        
        // Generate timestamp and password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        const axios = require('axios');
        
        // STK Push request
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
        
        // Save payment request to database
        db.query(
            'INSERT INTO payments (booking_id, amount, method, status, reference) VALUES (?, ?, ?, ?, ?)',
            [booking_id, amount, 'M-Pesa', 'Pending', stkResponse.data.CheckoutRequestID],
            (dbErr) => {
                if (dbErr) console.error('❌ Payment DB error:', dbErr);
            }
        );
        
        res.json({
            success: true,
            message: 'STK Push sent successfully',
            checkoutRequestID: stkResponse.data.CheckoutRequestID,
            responseCode: stkResponse.data.ResponseCode,
            responseDescription: stkResponse.data.ResponseDescription
        });
        
    } catch (error) {
        console.error('❌ STK Push error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'STK Push failed',
            details: error.response?.data || error.message 
        });
    }
});

// Check Payment Status
app.post('/api/mpesa/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.body;
        
        if (!checkoutRequestID) {
            return res.status(400).json({ error: 'checkoutRequestID is required' });
        }
        
        const accessToken = await getMpesaToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Failed to get M-Pesa access token' });
        }
        
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        const axios = require('axios');
        
        const statusResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            {
                BusinessShortCode: MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        
        res.json({ success: true, status: statusResponse.data });
        
    } catch (error) {
        console.error('❌ Status check error:', error);
        res.status(500).json({ 
            error: 'Status check failed',
            details: error.response?.data || error.message 
        });
    }
});

// M-Pesa Callback Endpoint (for Daraja to notify payment status)
app.post('/api/mpesa/callback', express.json(), (req, res) => {
    console.log('📥 M-Pesa Callback received:', JSON.stringify(req.body, null, 2));
    
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
        return res.status(400).json({ error: 'Invalid callback format' });
    }
    
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
    
    // Update payment status in database
    const status = ResultCode === '0' ? 'Success' : 'Failed';
    
    db.query(
        'UPDATE payments SET status = ?, reference = ? WHERE reference = ?',
        [status, ResultDesc, CheckoutRequestID],
        (err) => {
            if (err) {
                console.error('❌ Callback DB update error:', err);
            } else {
                console.log('✅ Payment status updated:', CheckoutRequestID, status);
                
                // If payment successful, update booking status
                if (status === 'Success') {
                    db.query(
                        'UPDATE bookings SET status = "Confirmed" WHERE id = (SELECT booking_id FROM payments WHERE reference = ?)',
                        [CheckoutRequestID]
                    );
                }
            }
        }
    );
    
    // Always respond with 200 to acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// ============ ERROR HANDLERS (Prevent Server Crashes) ============

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Log but don't exit - Railway will handle restarts
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Log but don't exit
});

// Handle graceful shutdown (Railway sends SIGTERM)
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    db.end(() => {
        console.log('✅ Database pool closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    db.end(() => {
        console.log('✅ Database pool closed');
        process.exit(0);
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 CORS allowed: ${corsOptions.origin.join(', ')}`);
    console.log('✅ Server initialized successfully');
});

// Handle server-level errors
server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

// Export app for testing (optional)
module.exports = app;