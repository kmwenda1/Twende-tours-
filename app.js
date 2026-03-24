/* --- Configuration & State --- */
const DB_KEY = 'twende_tours_db';
let currentUser = JSON.parse(sessionStorage.getItem('twende_current_user'));

// Seed Data
const seedData = {
    users: [
        { id: 1, name: 'John Doe', email: 'client@twende.com', password: '123', role: 'client' },
        { id: 2, name: 'Sarah Ops', email: 'staff@twende.com', password: '123', role: 'staff', is_approved: true },
        { id: 3, name: 'Big Boss', email: 'manager@twende.com', password: '123', role: 'manager' },
        { id: 4, name: 'New Guy', email: 'new@twende.com', password: '123', role: 'staff', is_approved: false }
    ],
    fleet: [
        { id: 101, name: 'Land Cruiser V8', type: '4x4', rate: 350, status: 'Available', image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800' },
        { id: 102, name: 'Toyota Prado', type: 'SUV', rate: 250, status: 'Booked', image: 'https://images.unsplash.com/photo-1596707328637-409869323520?auto=format&fit=crop&q=80&w=800' },
        { id: 103, name: 'Safari Van', type: 'Van', rate: 180, status: 'Available', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800' }
    ],
    trips: [
        { id: 1, client_id: 1, vehicle_id: 102, destination: 'Masai Mara', start: '2023-11-01', end: '2023-11-05', status: 'Completed' },
        { id: 2, client_id: 1, vehicle_id: 101, destination: 'Serengeti', start: '2023-12-10', end: '2023-12-15', status: 'Upcoming' }
    ],
    inquiries: [
        { id: 1, client: 'Jane Smith', email: 'jane@example.com', destination: 'Ngorongoro', notes: 'Need luxury tent.', date: '2023-10-20', read: false }
    ]
};

function initDB() {
    if (!localStorage.getItem(DB_KEY)) localStorage.setItem(DB_KEY, JSON.stringify(seedData));
}
function getDB() { return JSON.parse(localStorage.getItem(DB_KEY)); }
function saveDB(data) { localStorage.setItem(DB_KEY, JSON.stringify(data)); }

/* --- Auth Logic --- */
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);

    if (user) {
        if (user.role === 'staff' && !user.is_approved) {
            alert('Account pending approval.'); return;
        }
        sessionStorage.setItem('twende_current_user', JSON.stringify(user));
        window.location.href = `${user.role}.html`;
    } else { alert('Invalid credentials'); }
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const role = document.getElementById('regRole').value;
    const db = getDB();
    db.users.push({ id: Date.now(), name, email, password, role, is_approved: role === 'staff' ? false : true });
    saveDB(db);
    alert('Registered! Please login.');
    document.getElementById('regView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
}

function logout() {
    sessionStorage.removeItem('twende_current_user');
    window.location.href = 'index.html';
}

/* --- Navigation Logic (SPA Style within pages) --- */
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    // Show target
    document.getElementById(sectionId).classList.remove('hidden');
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if(activeLink) activeLink.classList.add('active');
}

/* --- Client Dashboard Logic --- */
function renderClientDashboard() {
    const db = getDB();
    const user = currentUser;
    
    // Header
    document.getElementById('clientGreeting').innerText = `Jambo, ${user.name} 🦁`;
    
    // Stats
    const userTrips = db.trips.filter(t => t.client_id === user.id);
    const activeTrips = userTrips.filter(t => t.status !== 'Completed').length;
    const completedTrips = userTrips.filter(t => t.status === 'Completed').length;
    
    document.getElementById('statActiveTrips').innerText = activeTrips;
    document.getElementById('statTotalSafaris').innerText = userTrips.length;
    document.getElementById('statCompleted').innerText = completedTrips;

    // Schedule List
    const listContainer = document.getElementById('clientTripList');
    if (userTrips.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="map-pin"></i>
                <h3>No safaris booked yet</h3>
                <p>Explore our fleet and start your adventure.</p>
            </div>`;
    } else {
        listContainer.innerHTML = userTrips.map(t => {
            const vehicle = db.fleet.find(v => v.id === t.vehicle_id);
            const vName = vehicle ? vehicle.name : 'Unassigned';
            let badgeClass = t.status === 'Upcoming' ? 'status-upcoming' : (t.status === 'Ongoing' ? 'status-ongoing' : 'status-completed');
            
            return `
            <div class="trip-card">
                <div class="trip-icon"><i data-lucide="map-pin"></i></div>
                <div class="trip-details">
                    <h3>${t.destination}</h3>
                    <div class="trip-meta">${vName} • ${t.start} → ${t.end}</div>
                </div>
                <span class="status-badge ${badgeClass}">${t.status}</span>
            </div>`;
        }).join('');
    }
    lucide.createIcons();
}

/* --- Staff Dashboard Logic --- */
function renderStaffDashboard() {
    // Reuse Client Dashboard logic for the main view
    renderClientDashboard();
    renderFleetControl();
    renderSocialInbox();
}

function renderFleetControl() {
    const db = getDB();
    const container = document.getElementById('staffFleetGrid');
    container.innerHTML = db.fleet.map(v => `
        <div class="vehicle-card">
            <img src="${v.image}" class="vehicle-img">
            <div class="vehicle-body">
                <div class="vehicle-header">
                    <h3>${v.name}</h3>
                    <span class="vehicle-price">$${v.rate}/day</span>
                </div>
                <p class="text-light text-sm">${v.type}</p>
                <div style="margin-top:15px;">
                    <label class="text-sm">Status:</label>
                    <select class="form-control" onchange="updateVehicleStatus(${v.id}, this.value)">
                        <option value="Available" ${v.status==='Available'?'selected':''}>Available</option>
                        <option value="Booked" ${v.status==='Booked'?'selected':''}>Booked</option>
                        <option value="Maintenance" ${v.status==='Maintenance'?'selected':''}>Maintenance</option>
                        <option value="Repair" ${v.status==='Repair'?'selected':''}>Repair</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
}

function updateVehicleStatus(id, newStatus) {
    const db = getDB();
    const v = db.fleet.find(x => x.id === id);
    if(v) { v.status = newStatus; saveDB(db); alert('Status Updated'); }
}

function renderSocialInbox() {
    const db = getDB();
    const container = document.getElementById('inboxList');
    container.innerHTML = db.inquiries.map(i => `
        <div class="inbox-item ${i.read ? 'inbox-read' : ''}">
            <div class="inbox-header">
                <strong>${i.client}</strong>
                <span class="text-sm text-light">${i.date}</span>
            </div>
            <p><strong>Dest:</strong> ${i.destination}</p>
            <p class="text-sm">${i.notes}</p>
            <button class="btn btn-sm btn-navy" style="margin-top:10px;" onclick="toggleRead(${i.id})">
                ${i.read ? 'Mark Unread' : 'Mark Read'}
            </button>
        </div>
    `).join('');
}

function toggleRead(id) {
    const db = getDB();
    const i = db.inquiries.find(x => x.id === id);
    if(i) { i.read = !i.read; saveDB(db); renderSocialInbox(); }
}

function handleBookingSubmit(e) {
    e.preventDefault();
    const db = getDB();
    const clientId = parseInt(document.getElementById('bookClient').value);
    const vehicleId = parseInt(document.getElementById('bookVehicle').value);
    const dest = document.getElementById('bookDest').value;
    const start = document.getElementById('bookStart').value;
    const end = document.getElementById('bookEnd').value;

    // Auto update vehicle status
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    if(vehicle) vehicle.status = 'Booked';

    db.trips.push({
        id: Date.now(),
        client_id: clientId,
        vehicle_id: vehicleId,
        destination: dest,
        start: start,
        end: end,
        status: 'Upcoming'
    });
    saveDB(db);
    alert('Booking Confirmed! Vehicle status set to Booked.');
    e.target.reset();
}

/* --- Manager Dashboard Logic --- */
function renderManagerDashboard() {
    const db = getDB();
    
    // KPIs
    const totalRevenue = db.trips.filter(t => t.status === 'Completed').reduce((acc, t) => {
        const v = db.fleet.find(x => x.id === t.vehicle_id);
        // Simple calculation: Rate * Days (approx 5 days for demo)
        return acc + (v ? v.rate * 5 : 0);
    }, 0);

    const activeFleet = db.fleet.filter(v => v.status === 'Booked').length;
    const availFleet = db.fleet.filter(v => v.status === 'Available').length;
    const totalClients = db.users.filter(u => u.role === 'client').length;

    document.getElementById('kpiRevenue').innerText = `$${totalRevenue}`;
    document.getElementById('kpiActiveFleet').innerText = activeFleet;
    document.getElementById('kpiAvailFleet').innerText = availFleet;
    document.getElementById('kpiClients').innerText = totalClients;

    // User Management
    const pendingStaff = db.users.filter(u => u.role === 'staff' && !u.is_approved);
    const userTable = document.getElementById('userTableBody');
    if(pendingStaff.length === 0) {
        userTable.innerHTML = '<tr><td colspan="3" class="text-center">No pending approvals</td></tr>';
    } else {
        userTable.innerHTML = pendingStaff.map(u => `
            <tr>
                <td style="padding:10px;">${u.name}</td>
                <td style="padding:10px;">${u.email}</td>
                <td style="padding:10px;">
                    <button class="btn btn-sm btn-primary" onclick="approveUser(${u.id})">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectUser(${u.id})">Reject</button>
                </td>
            </tr>
        `).join('');
    }

    // Render Charts
    renderCharts(db);
}

function approveUser(id) {
    const db = getDB();
    const u = db.users.find(x => x.id === id);
    if(u) { u.is_approved = true; saveDB(db); renderManagerDashboard(); }
}

function rejectUser(id) {
    const db = getDB();
    db.users = db.users.filter(u => u.id !== id);
    saveDB(db);
    renderManagerDashboard();
}

function renderCharts(db) {
    // Revenue Chart
    const ctx1 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Revenue ($)',
                data: [1200, 1900, 3000, 5000, 2300, 3400],
                backgroundColor: '#f59e0b'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Fleet Status Chart
    const ctx2 = document.getElementById('fleetChart').getContext('2d');
    const statusCounts = { Available: 0, Booked: 0, Maintenance: 0 };
    db.fleet.forEach(v => statusCounts[v.status] = (statusCounts[v.status] || 0) + 1);

    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* --- Initialization --- */
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    
    // Auth Listeners
    const loginForm = document.getElementById('loginForm');
    if(loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const regForm = document.getElementById('regForm');
    if(regForm) regForm.addEventListener('submit', handleRegister);

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', logout);

    // Role Routing
    const path = window.location.pathname;
    if (path.includes('client.html')) {
        renderClientDashboard();
        showSection('clientDash');
    } else if (path.includes('staff.html')) {
        renderStaffDashboard();
        showSection('staffDash');
    } else if (path.includes('manager.html')) {
        renderManagerDashboard();
        showSection('mgrDash');
    }
});