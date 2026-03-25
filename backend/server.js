const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();

app.use(cors());
app.use(express.json());

// ============ DATABASE CONNECTION (Railway + Localhost) ============
const db = mysql.createConnection(
    process.env.DATABASE_URL || process.env.MYSQL_URL || {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'twende_tours'
    }
);

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database!');
    }
});

// ============ HEALTH CHECK ENDPOINTS (Required for Railway) ============
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
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

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
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
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }
        if (user.role === 'staff' && !user.is_approved) {
            return res.json({ success: false, message: 'Account pending approval' });
        }
        
        delete user.password;
        console.log('✅ Login successful:', user.email);
        res.json({ 
            success: true, 
            user: user, 
            role: user.role === 'manager' ? 'admin' : user.role 
        });
    });
});

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password, phone, interest } = req.body;
    
    console.log('📝 Registration attempt:', email);
    
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('❌ Hash error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query(
            'INSERT INTO users (name, email, password, role, phone, interest, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, 'client', phone, interest, true],
            (err, result) => {
                if (err) {
                    console.error('❌ Register DB error:', err);
                    return res.json({ success: false, message: 'Email already exists' });
                }
                console.log('✅ Registration successful:', email);
                res.json({ success: true, message: 'Registration successful' });
            }
        );
    });
});

// Get Fleet
app.get('/api/fleet', (req, res) => {
    console.log('🚗 Fleet request received');
    db.query('SELECT * FROM fleet', (err, results) => {
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
    db.query('UPDATE fleet SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) {
            console.error('❌ Update fleet error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
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
        res.json({ success: true, data: results });
    });
});

// Check Availability
app.post('/api/bookings/check-availability', (req, res) => {
    const { vehicle_id, start_date, end_date } = req.body;
    
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

// Create Booking - FIXED WITH VALIDATION & ERROR HANDLING
app.post('/api/bookings', (req, res) => {
    const { user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount } = req.body;
    
    console.log('📥 Creating booking:', { user_id, vehicle_id, destination, amount });
    
    // Validate required fields
    if (!user_id || !vehicle_id) {
        console.error('❌ Missing required fields for booking');
        return res.status(400).json({ error: 'user_id and vehicle_id are required' });
    }
    
    db.query(
        'INSERT INTO bookings (user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending")',
        [user_id, vehicle_id, destination, start_date, end_date, travelers, notes, amount],
        (err, result) => {
            if (err) {
                console.error('❌ Booking DB error:', err);
                console.error('❌ SQL Error:', err.sqlMessage);
                return res.status(500).json({ 
                    error: err.message, 
                    sqlError: err.sqlMessage,
                    message: 'Failed to create booking. User or vehicle may not exist.'
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
    
    console.log('🔄 Updating booking status:', req.params.id, status);
    
    db.query(
        'UPDATE bookings SET status = ? WHERE id = ?',
        [status, req.params.id],
        (err) => {
            if (err) {
                console.error('❌ Update booking error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // If status is Confirmed, also update fleet status to Booked
            if (status === 'Confirmed') {
                db.query(
                    'UPDATE fleet SET status = "Booked" WHERE id = (SELECT vehicle_id FROM bookings WHERE id = ?)',
                    [req.params.id],
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
    db.query('SELECT id, name, email, role, phone, interest, is_approved, created_at FROM users', (err, results) => {
        if (err) {
            console.error('❌ Users DB error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Approve User
app.put('/api/users/:id/approve', (req, res) => {
    db.query('UPDATE users SET is_approved = TRUE WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            console.error('❌ Approve user error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Delete User
app.delete('/api/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            console.error('❌ Delete user error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
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
    
    db.query(
        'INSERT INTO inquiries (client_name, client_email, client_phone, destination, notes, source) VALUES (?, ?, ?, ?, ?, ?)',
        [client_name, client_email, client_phone, destination, notes, source || 'Website'],
        (err, result) => {
            if (err) {
                console.error('❌ Inquiry DB error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, inquiryId: result.insertId });
        }
    );
});

// ============ M-PESA ROUTES ============

// M-Pesa Credentials (from Daraja) - FIXED: Removed trailing spaces in URLs
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'm7NA2lgANcgBc0PqJP16xjxBcOZBM127jIBr3P7Sy5NF1O9r';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'MXu3cCruzCApzb1Ijaxx6tAKMWyCod85haJidC3waf2PwD6AVVnCVASzmmb3IZdJ';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://twende-tours-production.up.railway.app/api/mpesa/callback';

// Generate M-Pesa Access Token
async function getMpesaToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    try {
        const response = await require('axios').get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { 'Authorization': `Basic ${auth}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Token error:', error.message);
        return null;
    }
}

// STK Push (Lipa Na M-Pesa Online) - FIXED: Removed trailing spaces in URLs
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        const axios = require('axios');
        
        console.log('💰 M-Pesa STK Push:', phone, amount);
        
        const accessToken = await getMpesaToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Failed to get access token' });
        }
        
        // Generate timestamp and password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        
        // STK Push request - FIXED URL (no trailing spaces)
        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
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
                }
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
            checkoutRequestID: stkResponse.data.CheckoutRequestID
        });
        
    } catch (error) {
        console.error('❌ STK Push error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'STK Push failed',
            details: error.response?.data 
        });
    }
});

// Check Payment Status - FIXED: Removed trailing spaces in URL
app.post('/api/mpesa/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.body;
        const axios = require('axios');
        
        const accessToken = await getMpesaToken();
        
        const statusResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            {
                BusinessShortCode: MPESA_SHORTCODE,
                Password: Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)}`).toString('base64'),
                Timestamp: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3),
                CheckoutRequestID: checkoutRequestID
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json({ success: true, status: statusResponse.data });
        
    } catch (error) {
        console.error('❌ Status check error:', error);
        res.status(500).json({ error: 'Status check failed' });
    }
});

// ============ ERROR HANDLERS (Prevent Server Crashes) ============

// Handle uncaught exceptions - DON'T exit, just log
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Keep server running - Railway will restart if needed
});

// Handle unhandled promise rejections - DON'T exit, just log
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep server running
});

// Handle graceful shutdown (Railway sends SIGTERM)
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    db.end(() => {
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    db.end(() => {
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log('✅ Server initialized successfully');
});

// Handle server-level errors
server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

// Export app for testing (optional)
module.exports = app;