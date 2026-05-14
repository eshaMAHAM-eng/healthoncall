/* ==========================================================
   FIREBASE SERVICE — HealthOnCall
   Central Firestore service for all dashboards
   Replaces localStorage for appointments data
   ========================================================== */

// Firebase config (prefer doc/hoc-firebase-config.js loaded first)
var HOC_FIREBASE_CONFIG = (typeof window !== 'undefined' && window.HOC_FIREBASE_CONFIG) ? window.HOC_FIREBASE_CONFIG : {
    apiKey: "AIzaSyAYoa7561DL9CA-PAu2fkaC6xO80iYhZXw",
    authDomain: "healthoncall-97216.firebaseapp.com",
    projectId: "healthoncall-97216",
    storageBucket: "healthoncall-97216.firebasestorage.app",
    messagingSenderId: "159711752974",
    appId: "1:159711752974:web:0667526008707309e81d5f"
};

// Initialize Firebase (agar pehle se initialize nahi hua)
if (!window._hocFirebaseInit) {
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(HOC_FIREBASE_CONFIG);
            }
            window._hocDb = firebase.firestore();
            window._hocFirebaseInit = true;
        }
    } catch(e) {
        console.warn('Firebase init error:', e);
        window._hocFirebaseInit = false;
    }
}

/* ==========================================================
   HOC FIRESTORE SERVICE
   ========================================================== */
var HocDB = {

    // ── Firestore available hai? ──
    isAvailable: function() {
        return window._hocFirebaseInit && window._hocDb;
    },

    // ── Naya appointment save karo ──
    bookAppointment: async function(data) {
        var apt = {
            id: 'APT-' + Date.now(),
            patientName: data.patientName || 'Patient',
            patientId: data.patientId || 'p1',
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
            status: 'requested',
            rejectReason: '',
            prescription: null,
            labTests: [],
            labResults: [],
            doctorWhatsapp: '',
            createdAt: new Date().toISOString(),
            staffCheckedAt: null,
            staffApprovedAt: null,
            paidAt: null,
            doctorConfirmedAt: null,
            doctorStartedAt: null,
            doctorEndedAt: null,
            labOrderAt: null,
            labCompletedAt: null
        };

        // Fetch doctorWhatsapp from Doctors collection
        if (this.isAvailable() && data.doctorId) {
            try {
                var doctorSnap = await window._hocDb.collection('Doctors').doc(data.doctorId).get();
                if (doctorSnap.exists) {
                    apt.doctorWhatsapp = doctorSnap.data().whatsappNumber || '';
                }
            } catch(e) {
                console.warn('Could not fetch doctor whatsappNumber:', e);
            }
        }

        if (this.isAvailable()) {
            try {
                await window._hocDb.collection('Appointments').doc(apt.id).set(apt);
                console.log('Appointment saved to Firestore:', apt.id);
            } catch(e) {
                console.warn('Firestore save failed, using localStorage:', e);
                this._saveToLocal(apt);
                showToast('Connection issue — appointment saved locally', 'error');
            }
        } else {
            this._saveToLocal(apt);
        }

        // Also save to localStorage as backup
        this._saveToLocal(apt);
        return apt;
    },

    // ── Status update karo ──
    updateStatus: async function(aptId, updates) {
        if (this.isAvailable()) {
            try {
                await window._hocDb.collection('Appointments').doc(aptId).update(updates);
            } catch(e) {
                console.warn('Firestore update failed:', e);
            }
        }
        // Also update localStorage
        this._updateLocal(aptId, updates);
    },

    // ── Sab appointments get karo (one-time) ──
    getAppointments: async function() {
        if (this.isAvailable()) {
            try {
                var snap = await window._hocDb.collection('Appointments').orderBy('createdAt', 'desc').get();
                var apts = [];
                snap.forEach(function(doc) { apts.push(doc.data()); });
                // Sync to localStorage
                localStorage.setItem('hoc_appointments', JSON.stringify(apts));
                return apts;
            } catch(e) {
                console.warn('Firestore get failed, using localStorage:', e);
            }
        }
        return this._getFromLocal();
    },

    // ── Real-time listener ──
    onAppointmentsChange: function(callback) {
        if (this.isAvailable()) {
            return window._hocDb.collection('Appointments')
                .orderBy('createdAt', 'desc')
                .onSnapshot(function(snap) {
                    var apts = [];
                    snap.forEach(function(doc) { apts.push(doc.data()); });
                    // Sync to localStorage for offline fallback
                    localStorage.setItem('hoc_appointments', JSON.stringify(apts));
                    callback(apts);
                }, function(err) {
                    console.warn('Firestore listener error:', err);
                    callback(HocDB._getFromLocal());
                });
        } else {
            // Fallback: poll localStorage every 1 second
            var interval = setInterval(function() {
                callback(HocDB._getFromLocal());
            }, 1000);
            return function() { clearInterval(interval); }; // unsubscribe
        }
    },

    // ── Staff: Approve ──
    approveAppointment: async function(aptId, doctorName) {
        var updates = {
            status: 'staff-approved',
            staffApprovedAt: new Date().toISOString(),
            staffCheckedAt: new Date().toISOString()
        };
        await this.updateStatus(aptId, updates);
    },

    // ── Staff: Reject ──
    rejectAppointment: async function(aptId, reason) {
        var updates = {
            status: 'rejected',
            rejectReason: reason || 'Not specified',
            staffCheckedAt: new Date().toISOString()
        };
        await this.updateStatus(aptId, updates);
    },

    // ── Doctor: Confirm ──
    confirmAppointment: async function(aptId) {
        await this.updateStatus(aptId, {
            status: 'confirmed',
            doctorConfirmedAt: new Date().toISOString()
        });
    },

    // ── Doctor: Start ──
    startAppointment: async function(aptId) {
        await this.updateStatus(aptId, {
            status: 'in-progress',
            doctorStartedAt: new Date().toISOString()
        });
    },

    // ── Doctor: Complete + Prescription ──
    completeAppointment: async function(aptId, prescriptionData, labTests) {
        var labResults = (labTests || []).map(function(t) {
            return { test: t, status: 'pending', result: '', completedAt: null };
        });
        var updates = {
            status: 'completed',
            prescription: prescriptionData || null,
            labTests: labTests || [],
            labResults: labResults,
            doctorEndedAt: new Date().toISOString()
        };
        if (labTests && labTests.length > 0) {
            updates.labOrderAt = new Date().toISOString();
        }
        await this.updateStatus(aptId, updates);
    },

    // ── Lab: Submit Result ──
    submitLabResult: async function(aptId, testIndex, resultText) {
        // Get current appointment
        var apts = this._getFromLocal();
        var apt = apts.find(function(a) { return a.id === aptId; });
        if (!apt || !apt.labResults) return;

        apt.labResults[testIndex].status = 'completed';
        apt.labResults[testIndex].result = resultText;
        apt.labResults[testIndex].completedAt = new Date().toISOString();

        var allDone = apt.labResults.every(function(lr) { return lr.status === 'completed'; });
        var updates = { labResults: apt.labResults };
        if (allDone) updates.labCompletedAt = new Date().toISOString();

        await this.updateStatus(aptId, updates);
    },

    // ── localStorage helpers ──
    _getFromLocal: function() {
        try { return JSON.parse(localStorage.getItem('hoc_appointments')) || []; }
        catch(e) { return []; }
    },

    _saveToLocal: function(apt) {
        var apts = this._getFromLocal();
        var idx = apts.findIndex(function(a) { return a.id === apt.id; });
        if (idx === -1) apts.push(apt);
        else apts[idx] = apt;
        localStorage.setItem('hoc_appointments', JSON.stringify(apts));
    },

    _updateLocal: function(aptId, updates) {
        var apts = this._getFromLocal();
        var idx = apts.findIndex(function(a) { return a.id === aptId; });
        if (idx !== -1) {
            Object.assign(apts[idx], updates);
            localStorage.setItem('hoc_appointments', JSON.stringify(apts));
        }
    }
};

console.log('HocDB Firebase Service loaded. Firestore available:', HocDB.isAvailable());
