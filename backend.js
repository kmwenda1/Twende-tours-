/* =========================================
   Backend System - Complete Version
   ========================================= */

const DB_KEY = 'twende_db_v2';

// Seed Data with 6 Vehicles
const seedData = {
    users: [
        { id: 1, name: 'Manager', email: 'admin@twende.com', pass: '123', role: 'manager' },
        { id: 2, name: 'Receptionist', email: 'staff@twende.com', pass: '123', role: 'staff', is_approved: true },
        { id: 3, name: 'Client User', email: 'client@twende.com', pass: '123', role: 'client', interest: 'Safari', phone: '+254 700 000 000' }
    ],
    fleet: [
        { 
            id: 101, 
            name: 'Safari Van', 
            type: 'Van', 
            rate: 18000, 
            status: 'Available', 
            seats: 8,
            bags: 8,
            image: 'https://images.unsplash.com/photo-1566008885171-2a2dd16688a3?auto=format&fit=crop&q=80&w=800',
            description: 'Perfect for budget-friendly group safaris with excellent game viewing capabilities.'
        },
        { 
            id: 102, 
            name: 'Land Cruiser Prado', 
            type: 'SUV', 
            rate: 25000, 
            status: 'Available', 
            seats: 6,
            bags: 6,
            image: 'https://images.unsplash.com/photo-1596707328637-409869323520?auto=format&fit=crop&q=80&w=800',
            description: 'Comfortable mid-size SUV ideal for small families or couples.'
        },
        { 
            id: 103, 
            name: 'Land Cruiser 70', 
            type: '4x4', 
            rate: 30000, 
            status: 'Booked', 
            seats: 7,
            bags: 4,
            image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800',
            description: 'Classic rugged 4x4 for authentic safari adventures in tough terrain.'
        },
        { 
            id: 104, 
            name: 'Land Cruiser V8', 
            type: '4x4', 
            rate: 35000, 
            status: 'Available', 
            seats: 6,
            bags: 6,
            image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80&w=800',
            description: 'Luxury safari vehicle with powerful V8 engine and premium comfort.'
        },
        { 
            id: 105, 
            name: 'Toyota Hiace', 
            type: 'Bus', 
            rate: 22000, 
            status: 'Available', 
            seats: 14,
            bags: 10,
            image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800',
            description: 'Large capacity van perfect for big groups and corporate safaris.'
        },
        { 
            id: 106, 
            name: 'Land Cruiser VX', 
            type: 'SUV', 
            rate: 40000, 
            status: 'Maintenance', 
            seats: 7,
            bags: 7,
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=800',
            description: 'Top-of-the-line luxury SUV with all premium amenities.'
        }
    ],
    inquiries: [
        { id: 1, client: 'John Doe', email: 'john@test.com', date: '2023-10-01', status: 'NO ACTION', interest: 'Car Hire' }
    ],
    bookings: [
        { id: 501, vehicle_id: 102, date: '2023-12-25', status: 'Confirmed', client: 'Sarah Smith', destination: 'Masai Mara', endDate: '2023-12-28', travelers: 4 }
    ],
    payments: []
};

// Initialize Database
function initDB() {
    const currentVersion = 'v2';
    const storedVersion = localStorage.getItem('twende_db_version');
    
    if (storedVersion !== currentVersion || !localStorage.getItem(DB_KEY)) {
        localStorage.setItem(DB_KEY, JSON.stringify(seedData));
        localStorage.setItem('twende_db_version', currentVersion);
        console.log('Database initialized/updated to v2');
    }
}

// Get Database
function getDB() {
    return JSON.parse(localStorage.getItem(DB_KEY));
}

// Save Database
function saveDB(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// Authentication - Login
function login(email, pass) {
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.pass === pass);
    
    if (user) {
        if (user.role === 'staff' && !user.is_approved) {
            return { success: false, message: 'Account pending approval by admin' };
        }
        sessionStorage.setItem('twende_user', JSON.stringify(user));
        
        // Redirect based on role - FIXED: manager goes to admin.html
        if (user.role === 'manager') {
            return { success: true, role: 'admin' };
        }
        return { success: true, role: user.role };
    }
    return { success: false, message: 'Invalid email or password' };
}

// Authentication - Register
function register(data) {
    const db = getDB();
    
    // Check if email already exists
    const existingUser = db.users.find(u => u.email === data.email);
    if (existingUser) {
        return { success: false, message: 'Email already registered' };
    }
    
    const newUser = {
        id: Date.now(),
        name: data.name,
        email: data.email,
        pass: data.pass,
        role: 'client',
        interest: data.interest,
        phone: data.phone,
        preferences: {},
        communication: {
            email: true,
            sms: true,
            promo: false
        }
    };
    
    db.users.push(newUser);
    saveDB(db);
    
    return { success: true };
}

// Check Availability (Double Booking Prevention)
function checkAvailability(vehicleId, date) {
    const db = getDB();
    
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    if (!vehicle || vehicle.status === 'Maintenance') {
        return { available: false, reason: 'Vehicle under maintenance' };
    }
    
    const conflict = db.bookings.find(b => 
        b.vehicleId === vehicleId && 
        b.date === date && 
        (b.status === 'Confirmed' || b.status === 'Pending')
    );
    
    if (conflict) {
        return { available: false, reason: 'Date already booked by another client' };
    }
    
    return { available: true };
}

// Process Booking
function processBooking(bookingData) {
    const db = getDB();
    
    const check = checkAvailability(bookingData.vehicleId, bookingData.date);
    if (!check.available) {
        return { success: false, message: check.reason };
    }
    
    const newBooking = {
        id: Date.now(),
        clientName: bookingData.clientName,
        vehicleId: bookingData.vehicleId,
        date: bookingData.date,
        endDate: bookingData.endDate,
        destination: bookingData.destination,
        travelers: bookingData.travelers,
        status: 'Confirmed',
        amount: bookingData.amount
    };
    
    db.bookings.push(newBooking);
    
    const vehicle = db.fleet.find(v => v.id === bookingData.vehicleId);
    if (vehicle) vehicle.status = 'Booked';
    
    saveDB(db);
    
    return { success: true, bookingId: newBooking.id };
}

// Process Payment
function processPayment(method, amount) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const db = getDB();
            db.payments.push({ 
                id: Date.now(), 
                method, 
                amount, 
                status: 'Success', 
                date: new Date() 
            });
            saveDB(db);
            resolve({ success: true, ref: 'MPESA-' + Math.floor(Math.random() * 10000) });
        }, 2000);
    });
}

// Get Leakage Alerts
function getLeakageAlerts() {
    const db = getDB();
    const now = new Date();
    const alerts = [];
    
    db.inquiries.forEach(inq => {
        if (inq.status === 'NO ACTION') {
            const inquiryDate = new Date(inq.date);
            const diffTime = Math.abs(now - inquiryDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays > 1) {
                alerts.push(inq);
            }
        }
    });
    
    return alerts;
}

// Initialize on load
initDB();