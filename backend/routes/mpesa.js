const express = require('express');
const axios = require('axios');
const db = require('../database');

const router = express.Router();

// M-Pesa Credentials (from Daraja)
const CONSUMER_KEY = 'YOUR_CONSUMER_KEY_HERE';
const CONSUMER_SECRET = 'YOUR_CONSUMER_SECRET_HERE';
const SHORTCODE = '174379';  // Sandbox test shortcode
const PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://your-domain.com/api/mpesa/callback';  // Update for production

// Generate Access Token
async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Token error:', error.message);
        return null;
    }
}

// STK Push (Lipa Na M-Pesa Online)
router.post('/stkpush', async (req, res) => {
    try {
        const { phone, amount, booking_id } = req.body;
        
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return res.status(500).json({ error: 'Failed to get access token' });
        }
        
        // Generate timestamp and password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
        
        // STK Push request
        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: phone,  // Customer phone
                PartyB: SHORTCODE,
                PhoneNumber: phone,
                CallBackURL: CALLBACK_URL,
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
        await db.query(
            'INSERT INTO payments (booking_id, amount, method, status, reference) VALUES (?, ?, ?, ?, ?)',
            [booking_id, amount, 'M-Pesa', 'Pending', stkResponse.data.CheckoutRequestID]
        );
        
        res.json({
            success: true,
            message: 'STK Push sent successfully',
            checkoutRequestID: stkResponse.data.CheckoutRequestID
        });
        
    } catch (error) {
        console.error('STK Push error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'STK Push failed',
            details: error.response?.data 
        });
    }
});

// Callback (Safaricom sends payment confirmation here)
router.post('/callback', async (req, res) => {
    try {
        const callbackData = req.body;
        const resultCode = callbackData.Body.stkCallback.ResultCode;
        
        if (resultCode === 0) {
            // Payment successful
            const checkoutRequestID = callbackData.Body.stkCallback.CheckoutRequestID;
            const amount = callbackData.Body.stkCallback.CallbackMetadata.Item.find(
                item => item.Name === 'Amount'
            ).Value;
            const mpesaReceipt = callbackData.Body.stkCallback.CallbackMetadata.Item.find(
                item => item.Name === 'MpesaReceiptNumber'
            ).Value;
            
            // Update payment status
            await db.query(
                'UPDATE payments SET status = ?, reference = ? WHERE reference = ?',
                ['Success', mpesaReceipt, checkoutRequestID]
            );
            
            // Update booking status
            await db.query(
                'UPDATE bookings SET status = "Confirmed" WHERE id = (SELECT booking_id FROM payments WHERE reference = ?)',
                [checkoutRequestID]
            );
            
            console.log('✅ Payment confirmed:', mpesaReceipt);
        } else {
            // Payment failed/cancelled
            console.log('❌ Payment failed/cancelled');
        }
        
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

// Check Payment Status
router.post('/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.body;
        
        const accessToken = await getAccessToken();
        
        const statusResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            {
                BusinessShortCode: SHORTCODE,
                Password: Buffer.from(`${SHORTCODE}${PASSKEY}${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)}`).toString('base64'),
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
        
        res.json({
            success: true,
            status: statusResponse.data
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Status check failed' });
    }
});

module.exports = router;