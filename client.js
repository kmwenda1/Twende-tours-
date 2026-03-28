/* =========================================
   Client Portal JavaScript - CLEAN API VERSION
   ========================================= */

const API_BASE = "https://twende-tours-production.up.railway.app/api";

let currentUser = JSON.parse(sessionStorage.getItem('twende_user'));
let currentBookingId = null;
let fleetData = [];
let bookingsData = [];

// Initialize
document.addEventListener('DOMContentLoaded', async function () {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    await loadInitialData();
    loadUserData();
});

// ================= FETCH DATA =================

async function loadInitialData() {
    try {
        const [fleetRes, bookingsRes] = await Promise.all([
            fetch(`${API_BASE}/fleet`),
            fetch(`${API_BASE}/bookings`)
        ]);

        const fleetJson = await fleetRes.json();
        const bookingsJson = await bookingsRes.json();

        fleetData = fleetJson.data || [];
        bookingsData = bookingsJson.data || [];

        console.log("✅ Fleet:", fleetData);
        console.log("✅ Bookings:", bookingsData);

    } catch (err) {
        console.error("❌ Failed loading data:", err);
    }
}

// ================= USER =================

function loadUserData() {
    document.getElementById('dashUserName').textContent = currentUser.name;
}

// ================= FLEET =================

function loadFleet() {
    const grid = document.getElementById('fleetGrid');

    if (!fleetData.length) {
        grid.innerHTML = "<p>No vehicles found</p>";
        return;
    }

    grid.innerHTML = fleetData.map(vehicle => `
        <div class="fleet-card">
            <img src="${vehicle.image_url}" class="fleet-image">
            <h3>${vehicle.name}</h3>
            <p>${vehicle.type}</p>
            <button onclick="bookVehicle(${vehicle.id})">Book</button>
        </div>
    `).join('');
}

// ================= BOOKINGS =================

function loadTrips() {
    const userTrips = bookingsData.filter(b => b.user_id === currentUser.id);

    console.log("User Trips:", userTrips);
}

// ================= BOOK VEHICLE =================

function bookVehicle(vehicleId) {
    openRequestModal(vehicleId);
}

// ================= REQUEST MODAL =================

function openRequestModal(vehicleId = null) {
    document.getElementById('requestModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Store selected vehicle
    document.getElementById('requestModal').dataset.vehicleId = vehicleId;
}

function closeRequestModal() {
    document.getElementById('requestModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ================= CREATE BOOKING =================

async function submitSafariRequest(e) {
    e.preventDefault();

    const vehicleId = document.getElementById('requestModal').dataset.vehicleId;

    if (!vehicleId) {
        alert("Please select a vehicle first");
        return;
    }

    const destination = document.getElementById('reqDestination').value;
    const startDate = document.getElementById('reqDate').value;
    const travelers = document.getElementById('reqTravelers').value;
    const notes = document.getElementById('reqNotes').value;

    const endDate = startDate;

    const vehicle = fleetData.find(v => v.id == vehicleId);
    const amount = vehicle ? vehicle.rate || 0 : 0;

    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                vehicle_id: vehicleId,
                destination,
                start_date: startDate,
                end_date: endDate,
                travelers,
                notes,
                amount
            })
        });

        const data = await response.json();

        if (data.success) {
            currentBookingId = data.bookingId;
            alert("✅ Booking created successfully!");
            closeRequestModal();
            await loadInitialData();
        } else {
            alert("❌ Booking failed: " + data.message);
        }

    } catch (err) {
        console.error("❌ Booking error:", err);
        alert("Server error. Try again.");
    }
}

// ================= M-PESA =================

async function initiateMpesaPayment() {
    const phone = document.getElementById('mpesaPhone').value;

    if (!phone) {
        alert("Enter phone number");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/mpesa/stkpush`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                amount: 1000,
                booking_id: currentBookingId
            })
        });

        const data = await response.json();

        if (data.success) {
            alert("📲 Check your phone for payment");
        } else {
            alert("Payment failed");
        }

    } catch (err) {
        console.error(err);
    }
}

// ================= LOGOUT =================

function logout() {
    sessionStorage.removeItem('twende_user');
    window.location.href = 'index.html';
}