/* =========================================
   STAFF PORTAL JAVASCRIPT - COMPLETE
   ========================================= */

let currentUser = JSON.parse(sessionStorage.getItem('twende_user'));
let calendarInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    if (!currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'manager')) {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('staffName').textContent = currentUser.name;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    loadDashboard();
    lucide.createIcons();
});

// Toggle Sidebar (Mobile)
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// Show/Hide Sections
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    if (section === 'dashboard') {
        document.getElementById('dashboardSection').classList.remove('hidden');
        document.getElementById('dashboardSection').classList.add('active');
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Dashboard';
        loadDashboard();
    } else if (section === 'socialInbox') {
        document.getElementById('socialInboxSection').classList.remove('hidden');
        document.getElementById('socialInboxSection').classList.add('active');
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Social Inbox';
        loadSocialInbox();
    } else if (section === 'fleetStatus') {
        document.getElementById('fleetStatusSection').classList.remove('hidden');
        document.getElementById('fleetStatusSection').classList.add('active');
        document.querySelector('.nav-item:nth-child(4)').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Fleet Status';
        loadFleetStatus();
    } else if (section === 'bookingCalendar') {
        document.getElementById('bookingCalendarSection').classList.remove('hidden');
        document.getElementById('bookingCalendarSection').classList.add('active');
        document.querySelector('.nav-item:nth-child(5)').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Booking Calendar';
        initStaffCalendar();
    } else if (section === 'newBooking') {
        document.getElementById('newBookingSection').classList.remove('hidden');
        document.getElementById('newBookingSection').classList.add('active');
        document.querySelector('.nav-item:nth-child(6)').classList.add('active');
        document.getElementById('pageTitle').textContent = 'New Booking';
        loadNewBookingForm();
    }
    
    lucide.createIcons();
}

// Load Dashboard
function loadDashboard() {
    const db = getDB();
    
    // Stats
    const inquiries = db.inquiries || [];
    const bookings = db.bookings || [];
    const fleet = db.fleet || [];
    
    const newLeads = inquiries.length;
    const unreplied = inquiries.filter(i => i.status === 'NO ACTION').length;
    const activeBookings = bookings.filter(b => b.status === 'Confirmed' || b.status === 'Pending').length;
    const vehiclesAvailable = fleet.filter(v => v.status === 'Available').length;
    
    document.getElementById('statNewLeads').textContent = newLeads;
    document.getElementById('statUnreplied').textContent = unreplied;
    document.getElementById('statActiveBookings').textContent = activeBookings;
    document.getElementById('statVehiclesAvailable').textContent = vehiclesAvailable;
    document.getElementById('inboxBadge').textContent = unreplied;
    document.getElementById('notifBadge').textContent = unreplied;
    
    // Recent Inquiries
    loadRecentInquiries();
    
    // Today's Schedule
    loadTodaysSchedule();
}

// Load Recent Inquiries
function loadRecentInquiries() {
    const db = getDB();
    const inquiries = (db.inquiries || []).slice(-5).reverse();
    const container = document.getElementById('recentInquiries');
    
    if (inquiries.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px;">No inquiries yet</p>';
        return;
    }
    
    container.innerHTML = inquiries.map(inquiry => `
        <div class="inquiry-card ${inquiry.status === 'NO ACTION' ? 'unreplied' : 'replied'}">
            <div class="inquiry-header">
                <div class="inquiry-source">
                    <div class="source-icon website">
                        <i data-lucide="globe" width="16" height="16"></i>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-dark);">${inquiry.client}</div>
                        <div style="font-size: 0.875rem; color: var(--text-light);">${inquiry.email}</div>
                    </div>
                </div>
                <div class="inquiry-meta">
                    <span class="status-badge ${inquiry.status === 'NO ACTION' ? 'unreplied' : 'replied'}">
                        ${inquiry.status === 'NO ACTION' ? 'UNREPLIED' : 'REPLIED'}
                    </span>
                </div>
            </div>
            <div class="inquiry-content">
                <p>${inquiry.notes || 'Interested in booking a safari'}</p>
            </div>
            <div class="inquiry-actions">
                <button class="btn-primary" onclick="replyToInquiry(${inquiry.id})">
                    <i data-lucide="reply" width="16" height="16"></i>
                    Respond
                </button>
                <button class="btn-outline" onclick="convertToBooking(${inquiry.id})">
                    <i data-lucide="calendar-plus" width="16" height="16"></i>
                    Create Booking
                </button>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

// Load Today's Schedule
function loadTodaysSchedule() {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const bookings = (db.bookings || []).filter(b => b.date === today);
    const container = document.getElementById('todaysSchedule');
    
    if (bookings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px;">No trips scheduled for today</p>';
        return;
    }
    
    container.innerHTML = bookings.map(booking => {
        const vehicle = db.fleet.find(v => v.id === booking.vehicleId);
        return `
            <div class="inquiry-card replied" style="margin-bottom: 12px;">
                <div class="inquiry-header">
                    <div>
                        <div style="font-weight: 700; color: var(--text-dark);">${booking.destination}</div>
                        <div style="font-size: 0.875rem; color: var(--text-light);">${vehicle ? vehicle.name : 'Vehicle'}</div>
                    </div>
                    <span class="status-badge replied">${booking.status}</span>
                </div>
                <div class="inquiry-content">
                    <p>Client: ${booking.clientName} • ${booking.travelers || 4} travelers</p>
                </div>
            </div>
        `;
    }).join('');
}

// Load Social Inbox
function loadSocialInbox() {
    const db = getDB();
    const inquiries = db.inquiries || [];
    
    // Update stats
    const newLeads = inquiries.length;
    const unreplied = inquiries.filter(i => i.status === 'NO ACTION').length;
    const activeBookings = (db.bookings || []).filter(b => b.status === 'Confirmed' || b.status === 'Pending').length;
    const vehiclesAvailable = (db.fleet || []).filter(v => v.status === 'Available').length;
    
    document.getElementById('inboxStatNew').textContent = newLeads;
    document.getElementById('inboxStatUnreplied').textContent = unreplied;
    document.getElementById('inboxStatActive').textContent = activeBookings;
    document.getElementById('inboxStatVehicles').textContent = vehiclesAvailable;
    
    renderInboxList(inquiries);
}

// Filter Inbox
function filterInbox(filter) {
    document.querySelectorAll('.inbox-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const db = getDB();
    let inquiries = db.inquiries || [];
    
    if (filter === 'unreplied') {
        inquiries = inquiries.filter(i => i.status === 'NO ACTION');
    } else if (filter !== 'all') {
        inquiries = inquiries.filter(i => i.source === filter);
    }
    
    renderInboxList(inquiries);
}

// Render Inbox List
function renderInboxList(inquiries) {
    const container = document.getElementById('inboxList');
    
    if (inquiries.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px;">No inquiries found</p>';
        return;
    }
    
    container.innerHTML = inquiries.map(inquiry => {
        const source = inquiry.source || 'Website';
        const sourceClass = source.toLowerCase();
        const sourceIcon = source === 'WhatsApp' ? 'message-square' : 
                          source === 'Instagram' ? 'instagram' : 
                          source === 'TikTok' ? 'music' : 'globe';
        
        return `
            <div class="inquiry-card ${inquiry.status === 'NO ACTION' ? 'unreplied' : 'replied'}">
                <div class="inquiry-header">
                    <div class="inquiry-source">
                        <div class="source-icon ${sourceClass}">
                            <i data-lucide="${sourceIcon}" width="16" height="16"></i>
                        </div>
                        <div>
                            <div style="font-weight: 700; color: var(--text-dark);">${inquiry.client}</div>
                            <div style="font-size: 0.875rem; color: var(--text-light);">${inquiry.email}</div>
                        </div>
                    </div>
                    <div class="inquiry-meta">
                        <span class="status-badge ${inquiry.status === 'NO ACTION' ? 'unreplied' : 'replied'}">
                            ${inquiry.status === 'NO ACTION' ? 'UNREPLIED' : 'REPLIED'}
                        </span>
                        <span style="font-size: 0.875rem; color: var(--text-light);">${inquiry.timestamp || 'Recently'}</span>
                    </div>
                </div>
                <div class="inquiry-content">
                    <h3>${inquiry.destination || 'Safari Inquiry'}</h3>
                    <p>${inquiry.notes || 'Interested in booking a safari'}</p>
                </div>
                <div class="inquiry-actions">
                    <button class="btn-primary" onclick="replyToInquiry(${inquiry.id})">
                        <i data-lucide="reply" width="16" height="16"></i>
                        Respond
                    </button>
                    <button class="btn-outline" onclick="convertToBooking(${inquiry.id})">
                        <i data-lucide="calendar-plus" width="16" height="16"></i>
                        Create Booking
                    </button>
                    <button class="btn-outline" onclick="archiveInquiry(${inquiry.id})">
                        <i data-lucide="archive" width="16" height="16"></i>
                        Archive
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Load Fleet Status
function loadFleetStatus() {
    const db = getDB();
    const fleet = db.fleet || [];
    const tbody = document.getElementById('fleetTableBody');
    
    tbody.innerHTML = fleet.map(vehicle => `
        <tr>
            <td>
                <div class="vehicle-info">
                    <div class="vehicle-icon">
                        <i data-lucide="truck" width="20" height="20"></i>
                    </div>
                    <div>
                        <div class="vehicle-name">${vehicle.name}</div>
                        <div class="vehicle-type">${vehicle.type}</div>
                    </div>
                </div>
            </td>
            <td>KBC ${String(vehicle.id).slice(-3).toUpperCase()}</td>
            <td>${vehicle.seats || 6} seats</td>
            <td>
                <span class="status-badge ${vehicle.status === 'Available' ? 'replied' : vehicle.status === 'Booked' ? 'unreplied' : ''}" 
                      style="background: ${vehicle.status === 'Available' ? '#10b981' : vehicle.status === 'Booked' ? '#ef4444' : '#f59e0b'}; color: white;">
                    ${vehicle.status}
                </span>
            </td>
            <td>
                <select class="status-select ${vehicle.status.toLowerCase()}" 
                        onchange="updateVehicleStatus(${vehicle.id}, this.value)">
                    <option value="Available" ${vehicle.status === 'Available' ? 'selected' : ''}>Available</option>
                    <option value="Booked" ${vehicle.status === 'Booked' ? 'selected' : ''}>Booked</option>
                    <option value="Maintenance" ${vehicle.status === 'Maintenance' ? 'selected' : ''}>In Repair</option>
                </select>
            </td>
        </tr>
    `).join('');
    
    lucide.createIcons();
}

// Update Vehicle Status
function updateVehicleStatus(vehicleId, newStatus) {
    const db = getDB();
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    
    if (vehicle) {
        vehicle.status = newStatus;
        saveDB(db);
        loadFleetStatus();
        
        // Show notification
        alert(`Vehicle status updated to ${newStatus}`);
    }
}

// Initialize Staff Calendar
function initStaffCalendar() {
    const calendarEl = document.getElementById('staffCalendar');
    
    if (calendarInstance) {
        calendarInstance.destroy();
    }
    
    const db = getDB();
    const bookings = db.bookings || [];
    
    // Create calendar events
    const events = bookings.map(booking => {
        const vehicle = db.fleet.find(v => v.id === booking.vehicleId);
        return {
            title: `${booking.destination} (${vehicle ? vehicle.name : 'Safari'})`,
            start: booking.date,
            end: booking.endDate,
            backgroundColor: booking.status === 'Confirmed' ? '#10b981' : 
                           booking.status === 'Pending' ? '#f59e0b' : '#64748b',
            borderColor: 'transparent',
            textColor: 'white',
            extendedProps: {
                status: booking.status,
                vehicle: vehicle ? vehicle.name : 'Unknown',
                client: booking.clientName
            }
        };
    });
    
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        events: events,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        eventClick: function(info) {
            alert(`Destination: ${info.event.title}\nClient: ${info.event.extendedProps.client}\nVehicle: ${info.event.extendedProps.vehicle}\nStatus: ${info.event.extendedProps.status}`);
        },
        select: function(info) {
            // Check if date is available
            const hasConflict = bookings.some(b => {
                return info.startStr <= b.endDate && info.endStr >= b.date;
            });
            
            if (hasConflict) {
                alert('Selected dates have existing bookings. Please choose different dates.');
                calendarInstance.unselect();
            } else {
                showSection('newBooking');
                document.getElementById('newBookingStartDate').value = info.startStr;
                document.getElementById('newBookingEndDate').value = info.endStr;
                calendarInstance.unselect();
            }
        }
    });
    
    calendarInstance.render();
}

// Load New Booking Form
function loadNewBookingForm() {
    const db = getDB();
    const vehicles = db.fleet || [];
    const select = document.getElementById('newBookingVehicle');
    
    select.innerHTML = '<option value="">Choose a vehicle...</option>' + 
        vehicles.map(v => `<option value="${v.id}" ${v.status !== 'Available' ? 'disabled' : ''}>${v.name} (${v.seats} seats) - ${v.status}</option>`).join('');
}

// Check Vehicle Availability (DOUBLE-BOOKING PREVENTION)
function checkVehicleAvailability() {
    const vehicleId = parseInt(document.getElementById('newBookingVehicle').value);
    const startDate = document.getElementById('newBookingStartDate').value;
    const endDate = document.getElementById('newBookingEndDate').value;
    const container = document.getElementById('availabilityCheck');
    const submitBtn = document.getElementById('createBookingBtn');
    
    if (!vehicleId || !startDate || !endDate) {
        container.classList.add('hidden');
        submitBtn.disabled = true;
        return;
    }
    
    const db = getDB();
    const bookings = db.bookings || [];
    
    // Check for date conflicts
    const hasConflict = bookings.some(booking => {
        if (booking.vehicleId !== vehicleId) return false;
        if (booking.status === 'Completed' || booking.status === 'Cancelled') return false;
        
        // Check if dates overlap
        return (startDate <= booking.endDate && endDate >= booking.date);
    });
    
    container.classList.remove('hidden');
    
    if (hasConflict) {
        container.className = 'availability-check error';
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i data-lucide="alert-circle" width="20" height="20"></i>
                <div>
                    <strong>Vehicle Not Available</strong>
                    <p>This vehicle is already booked for the selected dates. Please choose different dates or another vehicle.</p>
                </div>
            </div>
        `;
        submitBtn.disabled = true;
    } else {
        container.className = 'availability-check success';
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i data-lucide="check-circle" width="20" height="20"></i>
                <div>
                    <strong>Vehicle Available</strong>
                    <p>This vehicle is available for the selected dates. You can proceed with the booking.</p>
                </div>
            </div>
        `;
        submitBtn.disabled = false;
    }
    
    lucide.createIcons();
}

// Create New Booking
function createNewBooking(e) {
    e.preventDefault();
    
    const vehicleId = parseInt(document.getElementById('newBookingVehicle').value);
    const startDate = document.getElementById('newBookingStartDate').value;
    
    // Final availability check
    const db = getDB();
    const bookings = db.bookings || [];
    
    const hasConflict = bookings.some(booking => {
        if (booking.vehicleId !== vehicleId) return false;
        if (booking.status === 'Completed' || booking.status === 'Cancelled') return false;
        return (startDate <= booking.endDate);
    });
    
    if (hasConflict) {
        alert('ERROR: This vehicle has been booked by another client while you were filling the form. Please refresh and try again.');
        return;
    }
    
    // Create booking
    const newBooking = {
        id: Date.now(),
        clientName: document.getElementById('newBookingClient').value,
        clientEmail: document.getElementById('newBookingEmail').value,
        clientPhone: document.getElementById('newBookingPhone').value,
        destination: document.getElementById('newBookingDestination').value,
        vehicleId: vehicleId,
        date: startDate,
        endDate: document.getElementById('newBookingEndDate').value,
        travelers: document.getElementById('newBookingTravelers').value,
        notes: document.getElementById('newBookingNotes').value,
        status: 'Confirmed',
        createdAt: new Date().toISOString()
    };
    
    db.bookings.push(newBooking);
    
    // Update vehicle status
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    if (vehicle) {
        vehicle.status = 'Booked';
    }
    
    saveDB(db);
    
    alert('✓ Booking created successfully!\n\nBooking ID: #' + newBooking.id);
    
    // Reset form
    e.target.reset();
    document.getElementById('availabilityCheck').classList.add('hidden');
    document.getElementById('createBookingBtn').disabled = true;
    
    showSection('bookingCalendar');
}

// Reply to Inquiry
function replyToInquiry(inquiryId) {
    const db = getDB();
    const inquiry = db.inquiries.find(i => i.id === inquiryId);
    
    if (inquiry) {
        inquiry.status = 'Replied';
        inquiry.repliedAt = new Date().toISOString();
        saveDB(db);
        
        alert('Marked as replied. In a real system, this would send an email/WhatsApp response.');
        loadDashboard();
        loadSocialInbox();
    }
}

// Convert Inquiry to Booking
function convertToBooking(inquiryId) {
    const db = getDB();
    const inquiry = db.inquiries.find(i => i.id === inquiryId);
    
    if (inquiry) {
        showSection('newBooking');
        document.getElementById('newBookingClient').value = inquiry.client;
        document.getElementById('newBookingEmail').value = inquiry.email;
        document.getElementById('newBookingDestination').value = inquiry.destination || '';
    }
}

// Archive Inquiry
function archiveInquiry(inquiryId) {
    const db = getDB();
    db.inquiries = db.inquiries.filter(i => i.id !== inquiryId);
    saveDB(db);
    loadSocialInbox();
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('twende_user');
        window.location.href = 'index.html';
    }
}