/* ==========================================================
   STORE.JS — HealthOnCall Central Data Store
   Ye file 4 dashboards ko connect karti hai:
   Patient → Staff → Doctor → Lab
   
   Save location: Wahi folder jahan 4 HTML files hain
   ========================================================== */

var AppStorage = {

    // ---- DATA ----
    appointments: [],

    // ---- LOAD from browser storage ----
    loadFromStorage: function () {
        try {
            var saved = localStorage.getItem('hoc_appointments');
            if (saved) {
                this.appointments = JSON.parse(saved);
            }
        } catch (e) {
            this.appointments = [];
        }
    },

    // ---- SAVE to browser storage ----
    saveToStorage: function () {
        localStorage.setItem('hoc_appointments', JSON.stringify(this.appointments));
    },

    // ---- RESET sab data ----
    resetAll: function () {
        this.appointments = [];
        this.saveToStorage();
    },

    // ---- PATIENT: Naya appointment book karo ----
    bookAppointment: function (data) {
        // data = { patientName, doctorName, doctorSpec, date, time, symptoms, visitType, address, fee, notes }
        var resolvedPid = (data.patientId && String(data.patientId).trim()) || '';
        if (!resolvedPid) {
            try { resolvedPid = (localStorage.getItem('hoc_patient_id') || '').trim(); } catch (e) { resolvedPid = ''; }
        }
        if (!resolvedPid) resolvedPid = 'p1';
        var apt = {
            id: 'APT-' + Date.now(),
            patientName: data.patientName || 'Patient',
            patientId: resolvedPid,
            doctorId: data.doctorId || '',
            doctorName: data.doctorName || '',
            doctorSpec: data.doctorSpec || '',
            date: data.date || '',
            time: data.time || '',
            symptoms: data.symptoms || '',
            visitType: data.visitType || 'Online',
            address: data.address || '',
            fee: data.fee || 0,
            notes: data.notes || '',
            status: 'requested',           // ← Flow shuru yahan se
            rejectReason: '',
            prescription: null,           // Doctor bharayega
            labTests: [],                 // Doctor order karega
            labResults: [],               // Lab bharayega
            doctorWhatsapp: data.doctorWhatsapp || '',  // Booking ke waqt Doctors collection se copy hota hai
            createdAt: new Date().toISOString(),
            staffCheckedAt: null,
            staffApprovedAt: null,
            doctorConfirmedAt: null,
            doctorStartedAt: null,
            doctorEndedAt: null,
            labOrderAt: null,
            labCompletedAt: null
        };
        this.appointments.push(apt);
        this.saveToStorage();
        return apt;
    },

    // ---- STAFF: Doctor available check karo ----
    isDoctorAvailable: function (aptId) {
        // Simple: hamesha true return karo (real mein API se check hota)
        return true;
    },

    // ---- STAFF: Appointment approve karo ----
    approveAppointment: function (aptId) {
        var apt = this.findById(aptId);
        if (!apt) return null;
        apt.status = 'staff-approved';
        apt.staffCheckedAt = new Date().toISOString();
        apt.staffApprovedAt = new Date().toISOString();
        this.saveToStorage();
        return apt;
    },

    // ---- STAFF: Appointment reject karo ----
    rejectAppointment: function (aptId, reason) {
        var apt = this.findById(aptId);
        if (!apt) return null;
        apt.status = 'rejected';
        apt.rejectReason = reason || 'Not specified';
        apt.staffCheckedAt = new Date().toISOString();
        this.saveToStorage();
        return apt;
    },

    // ---- DOCTOR: Appointment confirm karo ----
    confirmAppointment: function (aptId) {
        var apt = this.findById(aptId);
        if (!apt) return null;
        apt.status = 'confirmed';
        apt.doctorConfirmedAt = new Date().toISOString();
        this.saveToStorage();
        return apt;
    },

    // ---- DOCTOR: Appointment start karo ----
    startAppointment: function (aptId) {
        var apt = this.findById(aptId);
        if (!apt) return null;
        apt.status = 'in-progress';
        apt.doctorStartedAt = new Date().toISOString();
        this.saveToStorage();
        return apt;
    },

    // ---- DOCTOR: End + Prescription likho ----
    endWithPrescription: function (aptId, prescriptionData, labTests) {
        // prescriptionData = { diagnosis, medicines: [{name,dosage,frequency,duration}], notes }
        // labTests = ['Blood Test', 'Urine Test'] ya empty array
        var apt = this.findById(aptId);
        if (!apt) return null;
        apt.status = 'completed';
        apt.doctorEndedAt = new Date().toISOString();
        apt.prescription = prescriptionData || null;
        apt.labTests = labTests || [];

        // Agar lab tests hain to unke liye pending results bana do
        apt.labResults = [];
        if (labTests && labTests.length > 0) {
            labTests.forEach(function (testName) {
                apt.labResults.push({
                    test: testName,
                    status: 'pending',    // pending → completed
                    result: '',
                    completedAt: null
                });
            });
            apt.labOrderAt = new Date().toISOString();
        }
        this.saveToStorage();
        return apt;
    },

    // ---- LAB: Test result submit karo ----
    submitLabResult: function (aptId, testIndex, resultText) {
        var apt = this.findById(aptId);
        if (!apt || !apt.labResults) return null;
        if (apt.labResults[testIndex]) {
            apt.labResults[testIndex].status = 'completed';
            apt.labResults[testIndex].result = resultText;
            apt.labResults[testIndex].completedAt = new Date().toISOString();
        }
        // Check karo kya saare lab results ho gaye
        var allDone = apt.labResults.every(function (lr) {
            return lr.status === 'completed';
        });
        if (allDone) {
            apt.labCompletedAt = new Date().toISOString();
        }
        this.saveToStorage();
        return apt;
    },

    // ---- HELPER: ID se appointment dhundo ----
    findById: function (aptId) {
        return this.appointments.find(function (a) { return a.id === aptId; });
    },

    // ---- HELPER: Status ke hisaab se filter ----
    filterByStatus: function (status) {
        return this.appointments.filter(function (a) { return a.status === status; });
    },

    // ---- HELPER: Doctor ke pending appointments ----
    getDoctorPending: function () {
        return this.appointments.filter(function (a) {
            return a.status === 'staff-approved';
        });
    },

    // ---- HELPER: Lab ke pending tests ----
    getLabPending: function () {
        return this.appointments.filter(function (a) {
            return a.status === 'completed' && a.labResults && a.labResults.some(function (lr) {
                return lr.status === 'pending';
            });
        });
    },

    // ---- HELPER: Staff ke pending appointments ----
    getStaffPending: function () {
        return this.appointments.filter(function (a) {
            return a.status === 'requested';
        });
    },

    // ---- HELPER: Stats ----
    getStats: function () {
        var apts = this.appointments;
        return {
            total: apts.length,
            pending: apts.filter(function (a) { return a.status === 'requested'; }).length,
            staffApproved: apts.filter(function (a) { return a.status === 'staff-approved'; }).length,
            confirmed: apts.filter(function (a) { return a.status === 'confirmed'; }).length,
            inProgress: apts.filter(function (a) { return a.status === 'in-progress'; }).length,
            completed: apts.filter(function (a) { return a.status === 'completed'; }).length,
            rejected: apts.filter(function (a) { return a.status === 'rejected'; }).length,
            labPending: apts.filter(function (a) {
                return a.labResults && a.labResults.some(function (lr) { return lr.status === 'pending'; });
            }).length
        };
    }
};


/* ==========================================================
   UI HELPER FUNCTIONS — Sab dashboards mein use hongi
   ========================================================== */

// Appointments get karo (Patient dashboard ke liye)
function getAppointments() {
    AppStorage.loadFromStorage();
    return AppStorage.appointments;
}

// Status badge HTML
function statusBadgeHTML(status) {
    var map = {
        'Pending':        '<span class="badge badge-pending">Pending</span>',
        'staff-approved':  '<span class="badge badge-staff-approved">Staff Approved</span>',
        'confirmed':       '<span class="badge badge-confirmed">Confirmed</span>',
        'in-progress':     '<span class="badge badge-in-progress">In Progress</span>',
        'completed':       '<span class="badge badge-completed">Completed</span>',
        'rejected':        '<span class="badge badge-cancelled">Rejected</span>'
    };
    return map[status] || '<span class="badge badge-pending">' + (status || 'Unknown') + '</span>';
}

// Flow progress bar HTML
function flowProgressHTML(status) {
    var activeList = ['staff-approved', 'confirmed', 'in-progress', 'completed'];
    var idx = activeList.indexOf(status);

    var steps = [
        { label: 'Booked',   on: true },
        { label: 'Staff',    on: idx >= 0 },
        { label: 'Doctor',   on: idx >= 1 },
        { label: 'Done',     on: idx >= 3 }
    ];

    var h = '<div style="display:flex;gap:6px;align-items:center;">';
    steps.forEach(function (s, i) {
        var bg = s.on ? 'var(--accent)' : 'var(--border)';
        var tc = s.on ? 'var(--accent-dark)' : 'var(--text-muted)';
        h += '<div style="flex:1;text-align:center;">';
        h += '<div style="height:5px;background:' + bg + ';border-radius:3px;margin-bottom:5px;"></div>';
        h += '<div style="font-size:10px;font-weight:700;color:' + tc + ';">' + s.label + '</div>';
        h += '</div>';
        if (i < 3) {
            h += '<i class="fas fa-chevron-right" style="font-size:9px;color:var(--border);"></i>';
        }
    });
    h += '</div>';
    return h;
}

// Time ago function
function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
}

// Date format
function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hocLogout() {
    localStorage.removeItem('hoc_current_role');
    localStorage.removeItem('hoc_user');
    localStorage.setItem('hoc_manual_logout', '1');
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut().catch(function(){});
        }
    } catch(e) {}
    location.href = '../index.html?signedout=1';
}

// Toast function (agar kisi dashboard mein nahi hai)
function showToast(msg, type) {
    type = type || 'success';
    var c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.className = 'toast-container';
        c.id = 'toastContainer';
        c.style.cssText = 'position:fixed;top:24px;right:24px;z-index:5000;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(c);
    }
    var t = document.createElement('div');
    t.style.cssText = 'background:var(--card);border-radius:14px;padding:14px 22px;display:flex;align-items:center;gap:12px;box-shadow:0 16px 40px rgba(0,0,0,.12);border-left:4px solid var(--accent);font-size:14px;font-weight:600;color:var(--text);transform:translateX(120%);transition:transform .5s cubic-bezier(.34,1.56,.64,1);min-width:300px;';
    var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    var color = type === 'success' ? 'var(--accent)' : type === 'error' ? 'var(--rose)' : 'var(--sky)';
    t.style.borderLeftColor = color;
    t.innerHTML = '<i class="fas ' + icon + '" style="font-size:18px;color:' + color + ';"></i><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(function () { t.style.transform = 'translateX(0)'; }, 50);
    setTimeout(function () {
        t.style.transform = 'translateX(120%)';
        setTimeout(function () { t.remove(); }, 500);
    }, 3000);
}


/* ==========================================================
   INIT — Page load hone pe data load karo
   ========================================================== */
AppStorage.loadFromStorage();

// Debug: Console mein dekhne ke liye
console.log('STORE.JS loaded. Appointments:', AppStorage.appointments.length);