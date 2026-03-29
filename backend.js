/* =========================================
   Backend System - Railway API Version
   ========================================= */

// ✅ PRODUCTION API URL (Railway)
const API_URL = 'https://twende-tours-production.up.railway.app/api';

// Local fallback for development (optional)
// const API_URL = 'http://localhost:3000/api';

// ============ AUTHENTICATION ============

// Login
async function login(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Save user to sessionStorage
            sessionStorage.setItem('twende_user', JSON.stringify(data.user));
            return { success: true, role: data.role, user: data.user };
        }
        return { success: false, message: data.message || 'Login failed' };
        
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Connection error. Please check your internet.' };
    }
}

// Register
async function register(data) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                password: data.pass,
                phone: data.phone,
                interest: data.interest
            })
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, message: 'Connection error. Please try again.' };
    }
}

// Logout
function logout() {
    sessionStorage.removeItem('twende_user');
    window.location.href = 'index.html';
}

// Get Current User
function getCurrentUser() {
    const user = sessionStorage.getItem('twende_user');
    return user ? JSON.parse(user) : null;
}

// ============ FLEET ============

// Get All Vehicles
async function getFleet() {
    try {
        const response = await fetch(`${API_URL}/fleet`);
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Get fleet error:', error);
        return [];
    }
}

// Update Vehicle Status
async function updateFleetStatus(vehicleId, status) {
    try {
        const response = await fetch(`${API_URL}/fleet/${vehicleId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Update fleet status error:', error);
        return false;
    }
}

// ============ BOOKINGS ============

// Check Availability
async function checkAvailability(vehicleId, startDate, endDate) {
    try {
        const response = await fetch(`${API_URL}/bookings/check-availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicle_id: vehicleId, start_date: startDate, end_date: endDate })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Check availability error:', error);
        return { available: false, reason: 'Connection error' };
    }
}

// Create Booking
async function createBooking(bookingData) {
    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: bookingData.user_id,
                vehicle_id: bookingData.vehicle_id,
                destination: bookingData.destination,
                start_date: bookingData.start_date,
                end_date: bookingData.end_date,
                travelers: bookingData.travelers,
                notes: bookingData.notes,
                amount: bookingData.amount
            })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Create booking error:', error);
        return { success: false, message: 'Connection error' };
    }
}

// Get All Bookings
async function getBookings() {
    try {
        const response = await fetch(`${API_URL}/bookings`);
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Get bookings error:', error);
        return [];
    }
}

// Update Booking Status
async function updateBookingStatus(bookingId, status) {
    try {
        const response = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Update booking status error:', error);
        return false;
    }
}

// ============ M-PESA PAYMENTS ============

// Initiate M-Pesa STK Push
async function initiateMpesaPayment(phone, amount, bookingId) {
    try {
        const response = await fetch(`${API_URL}/mpesa/stkpush`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phone,
                amount: amount,
                booking_id: bookingId
            })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('M-Pesa STK Push error:', error);
        return { success: false, error: 'Connection error' };
    }
}

// Check M-Pesa Payment Status
async function checkMpesaStatus(checkoutRequestID) {
    try {
        const response = await fetch(`${API_URL}/mpesa/check-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutRequestID })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Check M-Pesa status error:', error);
        return { error: 'Connection error' };
    }
}

// ============ USERS ============

// Get All Users
async function getUsers() {
    try {
        const response = await fetch(`${API_URL}/users`);
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Get users error:', error);
        return [];
    }
}

// Approve User
async function approveUser(userId) {
    try {
        const response = await fetch(`${API_URL}/users/${userId}/approve`, {
            method: 'PUT'
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Approve user error:', error);
        return false;
    }
}

// Delete User
async function deleteUser(userId) {
    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Delete user error:', error);
        return false;
    }
}

// ============ INQUIRIES ============

// Get All Inquiries
async function getInquiries() {
    try {
        const response = await fetch(`${API_URL}/inquiries`);
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Get inquiries error:', error);
        return [];
    }
}

// Create Inquiry
async function createInquiry(inquiryData) {
    try {
        const response = await fetch(`${API_URL}/inquiries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: inquiryData.client_name,
                client_email: inquiryData.client_email,
                client_phone: inquiryData.client_phone,
                destination: inquiryData.destination,
                notes: inquiryData.notes,
                source: inquiryData.source || 'Website'
            })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Create inquiry error:', error);
        return { success: false, message: 'Connection error' };
    }
}

// Update Inquiry Status
async function updateInquiryStatus(inquiryId, status, assignedTo = null) {
    try {
        const response = await fetch(`${API_URL}/inquiries/${inquiryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, assigned_to: assignedTo })
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Update inquiry error:', error);
        return false;
    }
}

// ============ STATS & ANALYTICS ============

// Get Dashboard Stats
async function getDashboardStats() {
    try {
        const currentUser = getCurrentUser();  // ✅ GET CURRENT USER
        if (!currentUser) return {};
        
        const [bookings, users, fleet, inquiries] = await Promise.all([
            getBookings(),
            getUsers(),
            getFleet(),
            getInquiries()
        ]);
        
        // ✅ FILTER BOOKINGS BY CURRENT USER
        const userBookings = bookings.filter(b => b.user_id === currentUser.id);
        
        const revenue = userBookings
            .filter(b => b.status === 'Confirmed' || b.status === 'Completed')
            .reduce((sum, b) => sum + (b.amount || 0), 0);
        
        return {
            totalRevenue: revenue,
            totalBookings: userBookings.length,  // ✅ USES FILTERED BOOKINGS
            confirmedBookings: userBookings.filter(b => b.status === 'Confirmed').length,
            totalUsers: users.length,
            pendingApprovals: users.filter(u => u.role === 'staff' && !u.is_approved).length,
            availableFleet: fleet.filter(v => v.status === 'Available').length,
            totalFleet: fleet.length,
            newInquiries: inquiries.filter(i => i.status === 'NO ACTION').length
        };
    } catch (error) {
        console.error('Get stats error:', error);
        return {};
    }
}

// ============ LOCALSTORAGE FALLBACK (For Development Only) ============
// These are kept for local testing when backend is offline

const DB_KEY = 'twende_db_v2';
const seedData = {
    users: [
        { id: 1, name: 'Manager', email: 'admin@twende.com', pass: '123', role: 'manager' },
        { id: 2, name: 'Receptionist', email: 'staff@twende.com', pass: '123', role: 'staff', is_approved: true },
        { id: 3, name: 'Client User', email: 'client@twende.com', pass: '123', role: 'client', interest: 'Safari', phone: '+254 700 000 000' }
    ],
    fleet: [
    { id: 101, name: 'Safari Van', type: 'Van', rate: 18000, status: 'Available', seats: 8, bags: 8, image: 'https://images.unsplash.com/photo-1566008885171-2a2dd16688a3?w=400&h=300&fit=crop', description: 'Budget-friendly group safaris' },
    { id: 102, name: 'Land Cruiser Prado', type: 'SUV', rate: 25000, status: 'Available', seats: 6, bags: 6, image: 'https://images.unsplash.com/photo-1596707328637-409869323520?w=400&h=300&fit=crop', description: 'Comfortable mid-size SUV' },
    { id: 103, name: 'Land Cruiser 70', type: '4x4', rate: 30000, status: 'Booked', seats: 7, bags: 4, image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&h=300&fit=crop', description: 'Classic rugged 4x4' },
    { id: 104, name: 'Land Cruiser V8', type: '4x4', rate: 35000, status: 'Available', seats: 6, bags: 6, image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=400&h=300&fit=crop', description: 'Luxury safari vehicle' },
    { id: 105, name: 'Toyota Hiace', type: 'Bus', rate: 22000, status: 'Available', seats: 14, bags: 10, image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop', description: 'Large capacity van' },
    { id: 106, name: 'Land Cruiser VX', type: 'SUV', rate: 40000, status: 'Maintenance', seats: 7, bags: 7, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', description: 'Top luxury SUV' }
],
    inquiries: [],
    bookings: [],
    payments: []
};

function initLocalDB() {
    if (!localStorage.getItem(DB_KEY)) {
        localStorage.setItem(DB_KEY, JSON.stringify(seedData));
    }
}

function getLocalDB() {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}');
}

function saveLocalDB(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// Initialize localStorage on load (for development fallback)
initLocalDB();

// ============ EXPORTS ============
// Make functions available globally for HTML onclick handlers
window.login = login;
window.register = register;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.getFleet = getFleet;
window.updateFleetStatus = updateFleetStatus;
window.checkAvailability = checkAvailability;
window.createBooking = createBooking;
window.getBookings = getBookings;
window.updateBookingStatus = updateBookingStatus;
window.initiateMpesaPayment = initiateMpesaPayment;
window.checkMpesaStatus = checkMpesaStatus;
window.getUsers = getUsers;
window.approveUser = approveUser;
window.deleteUser = deleteUser;
window.getInquiries = getInquiries;
window.createInquiry = createInquiry;
window.updateInquiryStatus = updateInquiryStatus;
window.getDashboardStats = getDashboardStats;