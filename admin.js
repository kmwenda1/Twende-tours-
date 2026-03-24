/* =========================================
   ADMIN PORTAL JAVASCRIPT - FIXED
   ========================================= */

let currentUser = JSON.parse(sessionStorage.getItem('twende_user'));
let revenueChart = null;
let sourcesChart = null;
let inquiryChart = null;
let successChart = null;
let vehicleRevenueChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    if (!currentUser || currentUser.role !== 'manager') {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('adminName').textContent = currentUser.name;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    loadDashboard();
    lucide.createIcons();
});

// Toggle Sidebar
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// Show/Hide Sections - FIXED NAVIGATION
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section and activate corresponding nav item
    if (section === 'dashboard') {
        const sectionEl = document.getElementById('dashboardSection');
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
            sectionEl.classList.add('active');
        }
        document.getElementById('pageTitle').textContent = 'Admin Dashboard';
        
        // Find and activate the correct nav item
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[1]) navItems[1].classList.add('active');
        
        loadDashboard();
    } else if (section === 'userManagement') {
        const sectionEl = document.getElementById('userManagementSection');
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
            sectionEl.classList.add('active');
        }
        document.getElementById('pageTitle').textContent = 'User Management';
        
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[2]) navItems[2].classList.add('active');
        
        loadUserManagement();
    } else if (section === 'performanceReports') {
        const sectionEl = document.getElementById('performanceReportsSection');
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
            sectionEl.classList.add('active');
        }
        document.getElementById('pageTitle').textContent = 'Performance Reports';
        
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[4]) navItems[4].classList.add('active');
        
        loadPerformanceReports();
    } else if (section === 'revenueFinance') {
        const sectionEl = document.getElementById('revenueFinanceSection');
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
            sectionEl.classList.add('active');
        }
        document.getElementById('pageTitle').textContent = 'Revenue & Finance';
        
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[5]) navItems[5].classList.add('active');
        
        loadRevenueFinance();
    } else if (section === 'fleetManagement') {
        const sectionEl = document.getElementById('fleetManagementSection');
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
            sectionEl.classList.add('active');
        }
        document.getElementById('pageTitle').textContent = 'Fleet Management';
        
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[7]) navItems[7].classList.add('active');
        
        loadFleetManagement();
    }
    
    lucide.createIcons();
}

// Load Dashboard
function loadDashboard() {
    const db = getDB();
    
    // Calculate stats
    const revenue = db.payments.reduce((sum, p) => sum + p.amount, 0);
    const bookings = db.bookings.length;
    const inquiries = db.inquiries.length;
    const users = db.users.filter(u => u.role === 'client').length;
    const fleet = db.fleet;
    const available = fleet.filter(v => v.status === 'Available').length;
    const pendingApprovals = db.users.filter(u => u.role === 'staff' && !u.is_approved).length;
    
    document.getElementById('statRevenue').textContent = '$' + revenue.toLocaleString();
    document.getElementById('statBookings').textContent = bookings;
    document.getElementById('statInquiries').textContent = inquiries;
    document.getElementById('statUsers').textContent = users;
    document.getElementById('statFleetAvailable').textContent = `${available}/${fleet.length}`;
    document.getElementById('statPendingApprovals').textContent = pendingApprovals;
    document.getElementById('notifBadge').textContent = pendingApprovals;
    
    // Load Charts
    loadRevenueChart();
    loadSourcesChart();
}

// Load Revenue Chart
function loadRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Revenue',
                data: [45000, 52000, 48000, 61000, 75000, 58000, 67450],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Load Sources Chart
function loadSourcesChart() {
    const ctx = document.getElementById('sourcesChart');
    if (!ctx) return;
    
    if (sourcesChart) {
        sourcesChart.destroy();
    }
    
    sourcesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Website', 'WhatsApp', 'Instagram', 'TikTok', 'Referral'],
            datasets: [{
                data: [45, 25, 15, 10, 5],
                backgroundColor: ['#f59e0b', '#25d366', '#e6683c', '#000000', '#3b82f6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Load User Management
function loadUserManagement() {
    // Default to pending tab
    const db = getDB();
    const pendingUsers = db.users.filter(u => u.role === 'staff' && !u.is_approved);
    showUserTabContent(pendingUsers, 'pending');
    
    // Set active tab
    document.querySelectorAll('.tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
}

// Show User Tab Content
function showUserTabContent(users, tabType) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-light);">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const registeredDate = new Date(user.id).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-small">${initials}</div>
                        <div class="user-cell-info">
                            <div class="user-cell-name">${user.name}</div>
                            <div class="user-cell-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                <td>${registeredDate}</td>
                <td>
                    ${tabType === 'pending' ? `
                        <button class="btn-sm btn-success" onclick="approveUser(${user.id})">Approve</button>
                        <button class="btn-sm btn-danger" onclick="rejectUser(${user.id})">Reject</button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

// Show User Tab - FIXED
function showUserTab(tab, event) {
    if (event) {
        event.preventDefault();
    }
    
    const db = getDB();
    let users = [];
    
    if (tab === 'pending') {
        users = db.users.filter(u => u.role === 'staff' && !u.is_approved);
    } else if (tab === 'staff') {
        users = db.users.filter(u => u.role === 'staff' && u.is_approved);
    } else if (tab === 'clients') {
        users = db.users.filter(u => u.role === 'client');
    }
    
    showUserTabContent(users, tab);
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(tab === 'pending' ? 'pending' : tab === 'staff' ? 'staff' : 'client')) {
            btn.classList.add('active');
        }
    });
}

// Approve User
function approveUser(userId) {
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
        user.is_approved = true;
        saveDB(db);
        loadUserManagement();
        alert('User approved successfully!');
    }
}

// Reject User
function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user?')) return;
    
    const db = getDB();
    db.users = db.users.filter(u => u.id !== userId);
    saveDB(db);
    loadUserManagement();
    alert('User rejected and removed.');
}

// Load Performance Reports
function loadPerformanceReports() {
    loadInquiryTrendsChart();
    loadSuccessRateChart();
    loadPerformanceTable();
}

// Load Inquiry Trends Chart
function loadInquiryTrendsChart() {
    const ctx = document.getElementById('inquiryTrendsChart');
    if (!ctx) return;
    
    if (inquiryChart) {
        inquiryChart.destroy();
    }
    
    inquiryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Inquiries',
                data: [67, 95, 76, 89],
                backgroundColor: '#3b82f6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load Success Rate Chart
function loadSuccessRateChart() {
    const ctx = document.getElementById('successRateChart');
    if (!ctx) return;
    
    if (successChart) {
        successChart.destroy();
    }
    
    successChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Conversion Rate (%)',
                data: [45.5, 53.7, 49.8, 47.2],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 45,
                    max: 54
                }
            }
        }
    });
}

// Load Performance Table
function loadPerformanceTable() {
    const tbody = document.getElementById('performanceTableBody');
    if (!tbody) return;
    
    const data = [
        { month: 'November', inquiries: 67, bookings: 31, rate: '46.3%', revenue: '$45,000' },
        { month: 'December', inquiries: 95, bookings: 51, rate: '53.7%', revenue: '$75,000' },
        { month: 'January', inquiries: 76, bookings: 38, rate: '50.0%', revenue: '$58,000' },
        { month: 'February', inquiries: 89, bookings: 42, rate: '47.2%', revenue: '$67,450' }
    ];
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${row.month}</strong></td>
            <td>${row.inquiries}</td>
            <td>${row.bookings}</td>
            <td>${row.rate}</td>
            <td><strong>${row.revenue}</strong></td>
        </tr>
    `).join('');
}

// Load Revenue & Finance
function loadRevenueFinance() {
    const db = getDB();
    const revenue = db.payments.reduce((sum, p) => sum + p.amount, 0);
    
    document.getElementById('revenueThisMonth').textContent = '$' + revenue.toLocaleString();
    document.getElementById('revenueLastMonth').textContent = '$' + (revenue * 0.85).toLocaleString();
    document.getElementById('revenueGrowth').textContent = '+15%';
    
    loadVehicleRevenueChart();
}

// Load Vehicle Revenue Chart
function loadVehicleRevenueChart() {
    const ctx = document.getElementById('vehicleRevenueChart');
    if (!ctx) return;
    
    if (vehicleRevenueChart) {
        vehicleRevenueChart.destroy();
    }
    
    const db = getDB();
    const fleet = db.fleet;
    
    vehicleRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fleet.map(v => v.name),
            datasets: [{
                label: 'Revenue',
                data: fleet.map(v => v.rate * Math.floor(Math.random() * 20)),
                backgroundColor: '#f59e0b',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Load Fleet Management
function loadFleetManagement() {
    const db = getDB();
    const fleet = db.fleet;
    const tbody = document.getElementById('fleetTableBody');
    if (!tbody) return;
    
    if (fleet.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">No vehicles found</td></tr>';
        return;
    }
    
    tbody.innerHTML = fleet.map(vehicle => {
        const bookings = Math.floor(Math.random() * 20);
        const revenue = vehicle.rate * bookings;
        
        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-small" style="background: rgba(245, 158, 11, 0.1); color: var(--primary-gold);">
                            <i data-lucide="truck" width="20" height="20"></i>
                        </div>
                        <div class="user-cell-info">
                            <div class="user-cell-name">${vehicle.name}</div>
                            <div class="user-cell-email">${vehicle.type}</div>
                        </div>
                    </div>
                </td>
                <td>KBC ${String(vehicle.id).slice(-3).toUpperCase()}</td>
                <td><span class="status-badge ${vehicle.status.toLowerCase()}">${vehicle.status}</span></td>
                <td>$${vehicle.rate.toLocaleString()}/day</td>
                <td>${bookings}</td>
                <td><strong>$${revenue.toLocaleString()}</strong></td>
                <td>
                    <button class="btn-sm btn-success" onclick="editPrice(${vehicle.id})">Edit Price</button>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Edit Price
function editPrice(vehicleId) {
    const db = getDB();
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    
    if (vehicle) {
        const newPrice = prompt(`Enter new daily rate for ${vehicle.name}:`, vehicle.rate);
        
        if (newPrice && !isNaN(newPrice) && newPrice > 0) {
            vehicle.rate = parseInt(newPrice);
            saveDB(db);
            loadFleetManagement();
            alert('Price updated successfully!');
        }
    }
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('twende_user');
        window.location.href = 'index.html';
    }
}