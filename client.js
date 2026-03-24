/* =========================================
   Client Portal JavaScript - WITH M-PESA
   ========================================= */

let currentUser = JSON.parse(sessionStorage.getItem('twende_user'));
let currentBookingId = null;  // Store booking ID for payment

// Initialize Portal
document.addEventListener('DOMContentLoaded', function() {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    loadAllData();
    lucide.createIcons();
});

// Load All Data
function loadAllData() {
    loadUserData();
    loadStats();
    loadTrips();
    loadProfile();
}

// Load User Data
function loadUserData() {
    document.getElementById('dashUserName').textContent = currentUser.name;
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileFullName').value = currentUser.name;
    document.getElementById('profileEmailAddress').value = currentUser.email;
    document.getElementById('profilePhone').value = currentUser.phone || 'Not provided';
    document.getElementById('profileMemberSince').value = new Date().toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show/Hide Sections
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.portal-section').forEach(s => {
        s.classList.add('hidden-section');
    });
    
    // Remove active class from nav
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
    });
    
    // Show selected section
    if (section === 'dashboard') {
        document.getElementById('dashboardSection').classList.remove('hidden-section');
        document.querySelector('.nav-link:nth-child(1)').classList.add('active');
        loadStats();
        loadRecentTrips();
    } else if (section === 'myTrips') {
        document.getElementById('myTripsSection').classList.remove('hidden-section');
        document.querySelector('.nav-link:nth-child(2)').classList.add('active');
        loadStats();
        loadAllTrips();
    } else if (section === 'fleet') {
        document.getElementById('fleetSection').classList.remove('hidden-section');
        document.querySelector('.nav-link:nth-child(3)').classList.add('active');
        loadFleet();
    } else if (section === 'profile') {
        document.getElementById('profileSection').classList.remove('hidden-section');
        document.querySelector('.nav-link:nth-child(4)').classList.add('active');
        loadProfile();
    }
    
    lucide.createIcons();
    window.scrollTo(0, 0);
}

// Load Statistics
function loadStats() {
    const db = getDB();
    const userTrips = db.bookings.filter(b => b.clientName === currentUser.name);
    
    const total = userTrips.length;
    const upcoming = userTrips.filter(t => t.status === 'Confirmed' || t.status === 'Pending').length;
    const completed = userTrips.filter(t => t.status === 'Completed').length;
    
    // Calculate total spent
    const totalSpent = userTrips.reduce((sum, trip) => {
        const vehicle = db.fleet.find(v => v.id === trip.vehicleId);
        return sum + (vehicle ? vehicle.rate : 0);
    }, 0);
    
    // Update dashboard stats
    document.getElementById('statTotalTrips').textContent = total;
    document.getElementById('statUpcoming').textContent = upcoming;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statTotalSpent').textContent = '$' + totalSpent.toLocaleString();
    
    // Update trips section stats
    document.getElementById('tripsStatTotal').textContent = total;
    document.getElementById('tripsStatUpcoming').textContent = upcoming;
    document.getElementById('tripsStatCompleted').textContent = completed;
    document.getElementById('tripsStatSpent').textContent = '$' + totalSpent.toLocaleString();
    
    // Update profile stats
    document.getElementById('profileStatTrips').textContent = total;
    document.getElementById('profileStatUpcoming').textContent = upcoming;
    document.getElementById('profileStatCompleted').textContent = completed;
    document.getElementById('profileStatSpent').textContent = '$' + totalSpent.toLocaleString();
}

// Load Recent Trips (Dashboard)
function loadRecentTrips() {
    const db = getDB();
    const userTrips = db.bookings.filter(b => b.clientName === currentUser.name);
    const upcomingTrips = userTrips.filter(t => t.status === 'Confirmed' || t.status === 'Pending').slice(0, 3);
    
    const container = document.getElementById('recentTripsContainer');
    
    if (upcomingTrips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-x" width="48" height="48"></i>
                <h3>No upcoming trips</h3>
                <p style="margin: 16px 0;">Request your first safari adventure!</p>
                <button class="btn-primary" onclick="openRequestModal()">
                    <i data-lucide="plus" width="16" height="16"></i>
                    Request Safari
                </button>
            </div>
        `;
    } else {
        container.innerHTML = upcomingTrips.map(trip => createTripCard(trip, db)).join('');
    }
    lucide.createIcons();
}

// Load All Trips (My Trips Section)
function loadAllTrips() {
    const db = getDB();
    const userTrips = db.bookings.filter(b => b.clientName === currentUser.name);
    const upcomingTrips = userTrips.filter(t => t.status === 'Confirmed' || t.status === 'Pending');
    const completedTrips = userTrips.filter(t => t.status === 'Completed');
    
    // Load upcoming trips
    const upcomingContainer = document.getElementById('upcomingTripsContainer');
    if (upcomingTrips.length === 0) {
        upcomingContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-x" width="48" height="48"></i>
                <h3>No upcoming trips</h3>
            </div>
        `;
    } else {
        upcomingContainer.innerHTML = upcomingTrips.map(trip => createTripCard(trip, db)).join('');
    }
    
    // Load trip history table
    const historyBody = document.getElementById('tripHistoryBody');
    if (completedTrips.length === 0) {
        historyBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
                    No completed trips yet
                </td>
            </tr>
        `;
    } else {
        historyBody.innerHTML = completedTrips.map(trip => {
            const vehicle = db.fleet.find(v => v.id === trip.vehicleId);
            return `
                <tr>
                    <td><strong>${trip.destination || 'Masai Mara'}</strong></td>
                    <td>${vehicle ? vehicle.name : 'Unknown'}</td>
                    <td>${trip.date || 'TBA'} - ${trip.endDate || 'TBA'}</td>
                    <td>${trip.travelers || 4} people</td>
                    <td>$${vehicle ? vehicle.rate.toLocaleString() : '0'}</td>
                    <td><span class="trip-status completed">Completed</span></td>
                    <td><button class="btn-outline" style="padding: 6px 12px; font-size: 0.875rem;">Leave Review</button></td>
                </tr>
            `;
        }).join('');
    }
    lucide.createIcons();
}

// Create Trip Card HTML
function createTripCard(trip, db) {
    const vehicle = db.fleet.find(v => v.id === trip.vehicleId);
    const statusClass = trip.status === 'Confirmed' ? 'confirmed' : 'pending';
    
    return `
        <div class="trip-card">
            <div class="trip-card-header">
                <div class="trip-destination">
                    <i data-lucide="map-pin" width="20" height="20"></i>
                    ${trip.destination || 'Masai Mara National Reserve'}
                </div>
                <span class="trip-status ${statusClass}">${trip.status || 'Pending'}</span>
            </div>
            <div class="trip-details">
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="truck" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">Vehicle</div>
                        <div class="trip-detail-value">${vehicle ? vehicle.name : 'Unknown'}</div>
                    </div>
                </div>
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="calendar" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">Start Date</div>
                        <div class="trip-detail-value">${trip.date || 'TBA'}</div>
                    </div>
                </div>
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="calendar-check" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">End Date</div>
                        <div class="trip-detail-value">${trip.endDate || 'TBA'}</div>
                    </div>
                </div>
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="users" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">Travelers</div>
                        <div class="trip-detail-value">${trip.travelers || 4} People</div>
                    </div>
                </div>
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="dollar-sign" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">Total Cost</div>
                        <div class="trip-detail-value">$${vehicle ? vehicle.rate.toLocaleString() : '0'}</div>
                    </div>
                </div>
                <div class="trip-detail-item">
                    <div class="trip-detail-icon">
                        <i data-lucide="hash" width="20" height="20"></i>
                    </div>
                    <div class="trip-detail-content">
                        <div class="trip-detail-label">Booking ID</div>
                        <div class="trip-detail-value">#TW-${trip.id || '2024-001'}</div>
                    </div>
                </div>
            </div>
            <div class="trip-actions">
                <button class="btn-primary">
                    <i data-lucide="file-text" width="16" height="16"></i>
                    View Quotation
                </button>
                <button class="btn-outline" style="border-color: white; color: white;">
                    <i data-lucide="x" width="16" height="16"></i>
                    Cancel Request
                </button>
            </div>
        </div>
    `;
}

// Load Fleet
function loadFleet(filter = 'all') {
    const db = getDB();
    const grid = document.getElementById('fleetGrid');
    
    let vehicles = db.fleet;
    
    // Apply filter
    if (filter === 'Available') {
        vehicles = vehicles.filter(v => v.status === 'Available');
    } else if (filter === '4x4') {
        vehicles = vehicles.filter(v => v.type === '4x4' || v.type === 'SUV');
    } else if (filter === 'Van') {
        vehicles = vehicles.filter(v => v.type === 'Van' || v.type === 'Bus');
    }
    
    if (vehicles.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i data-lucide="truck" width="48" height="48"></i>
                <h3>No vehicles found</h3>
                <p>Try adjusting your filters</p>
            </div>
        `;
    } else {
        grid.innerHTML = vehicles.map(v => createFleetCard(v)).join('');
    }
    
    lucide.createIcons();
}

// Create Fleet Card HTML
function createFleetCard(vehicle) {
    const statusClass = vehicle.status === 'Available' ? 'available' : 
                       vehicle.status === 'Booked' ? 'booked' : 'maintenance';
    
    return `
        <div class="fleet-card">
            <img src="${vehicle.image}" alt="${vehicle.name}" class="fleet-image">
            <div class="fleet-card-body">
                <h3 class="fleet-card-title">${vehicle.name}</h3>
                <div class="fleet-specs">
                    <div class="fleet-spec">
                        <i data-lucide="users" width="16" height="16"></i>
                        <span>${vehicle.seats || 6} seats</span>
                    </div>
                    <div class="fleet-spec">
                        <i data-lucide="briefcase" width="16" height="16"></i>
                        <span>${vehicle.bags || 4} bags</span>
                    </div>
                </div>
                <div class="fleet-card-footer">
                    <span class="fleet-status ${statusClass}">${vehicle.status}</span>
                    <button class="btn-view-details" onclick="viewFleetDetails(${vehicle.id})">
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Filter Fleet
function filterFleet(filter) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadFleet(filter);
}

// View Fleet Details
function viewFleetDetails(vehicleId) {
    const db = getDB();
    const vehicle = db.fleet.find(v => v.id === vehicleId);
    
    if (!vehicle) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-portal active';
    modal.innerHTML = `
        <div class="modal-portal-content fleet-modal-content">
            <div class="modal-header">
                <h2 class="modal-title">${vehicle.name}</h2>
                <button class="close-modal" onclick="this.closest('.modal-portal').remove()">&times;</button>
            </div>
            <img src="${vehicle.image}" alt="${vehicle.name}" class="fleet-modal-image">
            
            <div class="fleet-detail-grid">
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Vehicle Type</div>
                    <div class="fleet-detail-value">${vehicle.type}</div>
                </div>
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Daily Rate</div>
                    <div class="fleet-detail-value">$${vehicle.rate.toLocaleString()}</div>
                </div>
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Seating Capacity</div>
                    <div class="fleet-detail-value">${vehicle.seats || 6} passengers</div>
                </div>
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Luggage Space</div>
                    <div class="fleet-detail-value">${vehicle.bags || 4} bags</div>
                </div>
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Status</div>
                    <div class="fleet-detail-value">${vehicle.status}</div>
                </div>
                <div class="fleet-detail-item">
                    <div class="fleet-detail-label">Transmission</div>
                    <div class="fleet-detail-value">Automatic</div>
                </div>
            </div>
            
            <div class="fleet-description">
                <h3 style="margin-bottom: 12px; color: var(--text-dark);">Vehicle Features</h3>
                <ul style="list-style: none; padding: 0; line-height: 2;">
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Air Conditioning</li>
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Pop-up Roof for Game Viewing</li>
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Refrigerator</li>
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Charging Ports</li>
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Comfortable Seating</li>
                    <li><i data-lucide="check" width="16" height="16" style="color: var(--success); vertical-align: middle; margin-right: 8px;"></i> Professional Driver-Guide</li>
                </ul>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button class="btn-primary btn-full" onclick="bookVehicle(${vehicle.id})" ${vehicle.status !== 'Available' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i data-lucide="calendar-plus" width="18" height="18"></i>
                    ${vehicle.status === 'Available' ? 'Book This Vehicle' : 'Currently Unavailable'}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    lucide.createIcons();
    
    // Close modal on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.remove();
        }
    });
}

// Book Vehicle
function bookVehicle(vehicleId) {
    // Close modal first
    document.querySelector('.modal-portal').remove();
    
    // Open request modal with pre-filled vehicle
    openRequestModal();
    
    alert('Vehicle selected! Please fill in your trip details.');
}

// Load Profile
function loadProfile() {
    const db = getDB();
    const userTrips = db.bookings.filter(b => b.clientName === currentUser.name);
    
    // Set preferences if they exist
    if (currentUser.preferences) {
        const prefs = currentUser.preferences;
        
        // Destinations
        if (prefs.destinations) {
            if (prefs.destinations.includes('Masai Mara')) document.getElementById('prefMasaiMara').checked = true;
            if (prefs.destinations.includes('Amboseli')) document.getElementById('prefAmboseli').checked = true;
            if (prefs.destinations.includes('Serengeti')) document.getElementById('prefSerengeti').checked = true;
            if (prefs.destinations.includes('Tsavo')) document.getElementById('prefTsavo').checked = true;
        }
        
        // Vehicle type
        if (prefs.vehicleType) {
            const radioButtons = document.querySelectorAll('input[name="vehicleType"]');
            radioButtons.forEach(radio => {
                if (radio.value === prefs.vehicleType) radio.checked = true;
            });
        }
        
        // Special requirements
        if (prefs.specialRequirements) {
            document.getElementById('specialRequirements').value = prefs.specialRequirements;
        }
    }
    
    // Communication preferences
    if (currentUser.communication) {
        const comm = currentUser.communication;
        document.getElementById('commEmail').checked = comm.email !== false;
        document.getElementById('commSMS').checked = comm.sms !== false;
        document.getElementById('commPromo').checked = comm.promo === true;
    }
}

// Open Request Modal
function openRequestModal() {
    document.getElementById('requestModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Reset payment section
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('paymentStatus').style.display = 'none';
}

// Close Request Modal
function closeRequestModal() {
    document.getElementById('requestModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Submit Safari Request - UPDATED WITH M-PESA
function submitSafariRequest(e) {
    e.preventDefault();
    
    const db = getDB();
    
    // Find a vehicle (first available)
    const availableVehicle = db.fleet.find(v => v.status === 'Available') || db.fleet[0];
    
    // Calculate amount (vehicle rate * days)
    const startDate = new Date(document.getElementById('reqDate').value);
    const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000); // Default 3 days
    const days = 3; // You can calculate actual days here
    const amount = availableVehicle.rate * days;
    
    // Create booking
    const booking = {
        id: Date.now(),
        clientName: currentUser.name,
        userId: currentUser.id,
        vehicleId: availableVehicle.id,
        destination: document.getElementById('reqDestination').value,
        date: document.getElementById('reqDate').value,
        endDate: endDate.toISOString().split('T')[0],
        travelers: document.getElementById('reqTravelers').value,
        notes: document.getElementById('reqNotes').value,
        status: 'Pending',
        amount: amount
    };
    
    // Save to database (via API if available, else localStorage)
    if (typeof createBooking === 'function') {
        // Using MySQL API
        createBooking({
            user_id: currentUser.id,
            vehicle_id: availableVehicle.id,
            destination: booking.destination,
            start_date: booking.date,
            end_date: booking.endDate,
            travelers: booking.travelers,
            notes: booking.notes,
            amount: booking.amount
        }).then(response => {
            if (response.success) {
                currentBookingId = response.bookingId;
                showPaymentSection(amount);
            } else {
                alert('Booking failed: ' + response.message);
            }
        });
    } else {
        // Using localStorage (fallback)
        db.bookings.push(booking);
        saveDB(db);
        currentBookingId = booking.id;
        showPaymentSection(amount);
    }
    
    // Don't close modal yet - show payment section
    e.target.reset();
    lucide.createIcons();
}

// Show Payment Section After Booking
function showPaymentSection(amount) {
    const paymentSection = document.getElementById('paymentSection');
    const paymentStatus = document.getElementById('paymentStatus');
    
    paymentSection.style.display = 'block';
    paymentStatus.style.display = 'none';
    
    // Update the submit button text
    document.getElementById('submitBookingBtn').style.display = 'none';
    
    // Show amount
    paymentStatus.innerHTML = `
        <div style="margin-bottom: 12px; color: #374151;">
            <strong>Amount:</strong> KES ${amount.toLocaleString()}
        </div>
    `;
    paymentStatus.style.display = 'block';
    
    // Pre-fill phone number if available
    const phoneInput = document.getElementById('mpesaPhone');
    if (currentUser.phone) {
        phoneInput.value = currentUser.phone.replace('+', '').replace(/\s/g, '');
    }
}

// ============ M-PESA PAYMENT FUNCTIONS ============

// Initiate M-Pesa Payment
async function initiateMpesaPayment() {
    const phone = document.getElementById('mpesaPhone').value;
    const paymentStatus = document.getElementById('paymentStatus');
    
    // Validate phone number
    if (!phone || phone.length < 10) {
        alert('Please enter a valid phone number (e.g., 254708374149)');
        return;
    }
    
    // Show loading
    paymentStatus.innerHTML = `
        <div class="payment-loading">
            <div class="spinner"></div>
            Sending payment request to your phone...
        </div>
    `;
    paymentStatus.style.display = 'block';
    
    try {
        const response = await fetch('http://localhost:3000/api/mpesa/stkpush', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                amount: 1000, // You can get this from booking amount
                booking_id: currentBookingId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            paymentStatus.innerHTML = `
                <div class="payment-success">
                    <strong>✓ Payment request sent!</strong><br>
                    Check your phone and enter PIN <strong>4321</strong> to complete payment.
                </div>
            `;
            
            // Start checking payment status
            checkPaymentStatus(data.checkoutRequestID);
        } else {
            paymentStatus.innerHTML = `
                <div class="payment-error">
                    <strong>✗ Payment failed</strong><br>
                    ${data.error || 'Please try again'}
                </div>
            `;
        }
    } catch (error) {
        paymentStatus.innerHTML = `
            <div class="payment-error">
                <strong>✗ Connection error</strong><br>
                Make sure backend server is running on port 3000
            </div>
        `;
        console.error('Payment error:', error);
    }
}

// Check Payment Status
async function checkPaymentStatus(checkoutRequestID) {
    const paymentStatus = document.getElementById('paymentStatus');
    
    // Check every 5 seconds for 2 minutes
    let attempts = 0;
    const maxAttempts = 24; // 24 * 5 seconds = 2 minutes
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch('http://localhost:3000/api/mpesa/check-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    checkoutRequestID: checkoutRequestID
                })
            });
            
            const data = await response.json();
            
            if (data.status && data.status.ResultCode === 0) {
                // Payment successful!
                clearInterval(checkInterval);
                
                // Get receipt number
                const receiptItem = data.status.CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber');
                const receipt = receiptItem ? receiptItem.Value : 'N/A';
                
                paymentStatus.innerHTML = `
                    <div class="payment-success">
                        <strong>✓ Payment Confirmed!</strong><br>
                        Your booking has been confirmed.
                        <br>Receipt: ${receipt}
                    </div>
                `;
                
                // Update booking status in database
                await updateBookingStatus(currentBookingId, 'Confirmed');
                
                // Hide payment section after 3 seconds
                setTimeout(() => {
                    closeRequestModal();
                    loadAllData(); // Refresh dashboard
                    alert('🎉 Booking confirmed! Check your trips.');
                }, 3000);
                
            } else if (data.status && data.status.ResultCode !== 0) {
                // Payment failed/cancelled
                clearInterval(checkInterval);
                paymentStatus.innerHTML = `
                    <div class="payment-error">
                        <strong>✗ Payment cancelled or failed</strong><br>
                        Please try again or contact support
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Status check error:', error);
        }
        
        // Stop after max attempts
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            paymentStatus.innerHTML += `
                <div style="color: #92400e; background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 12px;">
                    <strong>⏳ Still waiting...</strong><br>
                    Payment may still be processing. Check your booking status later.
                </div>
            `;
        }
        
    }, 5000); // Check every 5 seconds
}

// Update Booking Status
async function updateBookingStatus(bookingId, status) {
    try {
        // Try API first
        if (typeof fetch !== 'undefined') {
            await fetch(`http://localhost:3000/api/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: status })
            });
        } else {
            // Fallback to localStorage
            const db = getDB();
            const booking = db.bookings.find(b => b.id === bookingId);
            if (booking) {
                booking.status = status;
                saveDB(db);
            }
        }
    } catch (error) {
        console.error('Failed to update booking status:', error);
    }
}

// Change Password
function changePassword() {
    const newPassword = prompt('Enter new password:');
    if (newPassword && newPassword.length >= 4) {
        const db = getDB();
        const user = db.users.find(u => u.email === currentUser.email);
        if (user) {
            user.pass = newPassword;
            saveDB(db);
            alert('✓ Password changed successfully!');
        }
    } else if (newPassword) {
        alert('Password must be at least 4 characters long.');
    }
}

// Save Profile
function saveProfile() {
    const db = getDB();
    const user = db.users.find(u => u.email === currentUser.email);
    
    if (user) {
        // Save preferences
        const destinations = [];
        if (document.getElementById('prefMasaiMara').checked) destinations.push('Masai Mara');
        if (document.getElementById('prefAmboseli').checked) destinations.push('Amboseli');
        if (document.getElementById('prefSerengeti').checked) destinations.push('Serengeti');
        if (document.getElementById('prefTsavo').checked) destinations.push('Tsavo');
        
        const vehicleTypeRadio = document.querySelector('input[name="vehicleType"]:checked');
        
        user.preferences = {
            destinations: destinations,
            vehicleType: vehicleTypeRadio ? vehicleTypeRadio.value : '',
            specialRequirements: document.getElementById('specialRequirements').value
        };
        
        // Save communication preferences
        user.communication = {
            email: document.getElementById('commEmail').checked,
            sms: document.getElementById('commSMS').checked,
            promo: document.getElementById('commPromo').checked
        };
        
        saveDB(db);
        alert('✓ Profile updated successfully!');
    }
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('twende_user');
        window.location.href = 'index.html';
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('requestModal');
    if (e.target === modal) {
        closeRequestModal();
    }
});

// Allow Escape key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeRequestModal();
    }
});