/** HealthOnCall — 6 booking services + doctor/service helpers */
window.hocIsFileProtocol = function hocIsFileProtocol() {
  return typeof location !== 'undefined' && location.protocol === 'file:';
};

/**
 * Firestore may run before the Auth ID token is attached (permission-denied on first reads).
 * Force-refresh the token and probe UserIndex until reads succeed or retries exhaust.
 */
window.hocEnsureFirestoreAuthReady = function hocEnsureFirestoreAuthReady(db, user, opts) {
  if (!db || !user || !user.uid) return Promise.resolve(false);
  opts = opts || {};
  var tries = opts.tries || 12;
  var delayMs = opts.delayMs || 200;
  var uid = user.uid;

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function refreshToken() {
    return user.getIdToken(true).catch(function () {
      return user.getIdToken(false).catch(function () { return ''; });
    });
  }

  return refreshToken().then(function probe(attempt) {
    return db.collection('UserIndex').doc(uid).get().then(function () {
      return true;
    }).catch(function (e) {
      if (!e || e.code !== 'permission-denied' || attempt >= tries - 1) {
        if (e && e.code === 'permission-denied') return false;
        throw e;
      }
      return wait(delayMs).then(refreshToken).then(function () { return probe(attempt + 1); });
    });
  });
};

/** Sign out with timeout + clear Firebase auth cache (file:// can hang on signOut). */
window.hocForceSignOut = function hocForceSignOut(authInst) {
  var a = authInst;
  if (!a && typeof firebase !== 'undefined' && firebase.auth) {
    try { a = firebase.auth(); } catch (e0) { a = null; }
  }
  return Promise.race([
    a && a.signOut ? a.signOut().catch(function () {}) : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1500); })
  ]).then(function () {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('firebase:') === 0 || k.indexOf('firebaseLocalStorage') === 0) localStorage.removeItem(k);
      });
    } catch (e1) {}
  });
};

/** Leave any dashboard — never await Firebase; redirect immediately. */
window.hocLogoutAndGoHome = function hocLogoutAndGoHome() {
  try { localStorage.setItem('hoc_manual_logout', '1'); } catch (e0) {}
  try {
    ['hoc_user', 'hoc_doctor_id', 'hoc_patient_id', 'hoc_patient_name', 'hoc_current_role', 'hoc_preview'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e1) {}
    });
  } catch (e2) {}
  try { if (typeof hocForceSignOut === 'function') hocForceSignOut(null); } catch (e3) {}
  var dest = 'index.html?signedout=1';
  try {
    var p = location.pathname || '';
    if (p.indexOf('/staff/') >= 0 || p.indexOf('/patient/') >= 0 || p.indexOf('/doc/') >= 0 || p.indexOf('/lab') >= 0) {
      dest = '../index.html?signedout=1';
    }
  } catch (e4) {}
  window.location.assign(dest);
};

window.HOC_SERVICE_IDS = [
  'Home Nursing', 'Physiotherapy', 'Lab Tests',
  'Speech Therapy', 'General Physician', 'Psychologist'
];

window.hocMapToService = function (text) {
  var t = String(text || '').toLowerCase();
  if (!t) return 'General Physician';
  if (t.indexOf('nurs') >= 0) return 'Home Nursing';
  if (t.indexOf('physio') >= 0 || t.indexOf('rehab') >= 0) return 'Physiotherapy';
  if (t.indexOf('lab') >= 0 || t.indexOf('patholog') >= 0) return 'Lab Tests';
  if (t.indexOf('speech') >= 0) return 'Speech Therapy';
  if (t.indexOf('psych') >= 0 || t.indexOf('mental') >= 0) return 'Psychologist';
  if (t.indexOf('dent') >= 0) return 'General Physician';
  return 'General Physician';
};

window.hocDoctorIdForBooking = function (doc) {
  if (!doc) return '';
  if (doc.doctorId) return String(doc.doctorId);
  if (typeof doc.id === 'number') return 'doc_' + doc.id;
  return String(doc.id);
};

window.hocApptServiceMatches = function (apt, profile) {
  if (!apt) return false;
  profile = profile || {};
  try {
    if (!profile.name) profile = JSON.parse(localStorage.getItem('hoc_user') || '{}');
  } catch (e) {}
  var mySvc = typeof hocMapToService === 'function'
    ? hocMapToService(profile.service || profile.specialization || profile.department || '')
    : String(profile.service || profile.specialization || profile.department || '').trim();
  var aptSvc = typeof hocMapToService === 'function'
    ? hocMapToService(apt.service || apt.doctorSpec || '')
    : String(apt.service || apt.doctorSpec || '').trim();
  if (!mySvc) return true;
  if (!aptSvc) return false;
  return mySvc === aptSvc;
};

window.hocApptBelongsToDoctor = function (apt, doctorId) {
  if (!apt || !doctorId) return false;
  try {
    if (apt.doctorUid && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser
      && apt.doctorUid === firebase.auth().currentUser.uid) return true;
  } catch (e0) {}
  var profile = {};
  try { profile = JSON.parse(localStorage.getItem('hoc_user') || '{}'); } catch (e) { profile = {}; }
  var did = String(doctorId);
  var profileDid = String(profile.doctorId || did);
  var profileDocId = '';
  try { profileDocId = String(localStorage.getItem('hoc_doctor_id') || ''); } catch (e2) {}
  var aid = String(apt.doctorId || '');

  function normName(s) {
    return String(s || '').toLowerCase().replace(/^dr\.?\s*/gi, '').trim();
  }

  if (aid) {
    var idMatch = aid === did || aid === profileDid || aid === profileDocId
      || profileDocId === aid
      || aid.replace(/^doc_/, '') === did.replace(/^doc_/, '')
      || aid.replace(/^doc_/, '') === profileDid.replace(/^doc_/, '');
    if (idMatch) return true;
  }

  var myName = normName(profile.name);
  var aptDoc = normName(apt.doctorName || apt.doctor);
  if (myName && aptDoc && (myName === aptDoc || aptDoc.indexOf(myName) >= 0 || myName.indexOf(aptDoc) >= 0)) {
    return true;
  }

  if (typeof hocApptServiceMatches === 'function' && hocApptServiceMatches(apt, profile) && aptDoc && myName) {
    return aptDoc === myName || aptDoc.indexOf(myName) >= 0 || myName.indexOf(aptDoc) >= 0;
  }

  return false;
};

/** True when this doctor has at least one appointment with the patient (treating relationship). */
window.hocDoctorTreatsPatient = function (patientId, doctorId) {
  if (!patientId || !doctorId) return false;
  var apts = [];
  try { apts = JSON.parse(localStorage.getItem('hoc_appointments') || '[]'); } catch (e) { apts = []; }
  return apts.some(function (a) {
    if (String(a.patientId || '') !== String(patientId)) return false;
    return typeof hocApptBelongsToDoctor === 'function' && hocApptBelongsToDoctor(a, doctorId);
  });
};

/** Doctor / lab: dashboard only after admin sets status active (self-register starts as pending). */
window.hocRoleCanAccessDashboard = function (profile) {
  if (!profile || !profile.role) return false;
  if (profile.role === 'Patient' || profile.role === 'Staff') return true;
  if (profile.status === 'rejected') return false;
  if (profile.status === 'pending') return false;
  if (profile.verified === false) return false;
  return profile.status === 'active';
};

/** FYP — one pre-provisioned system administrator (Staff portal). No public staff registration. */
window.HOC_SINGLE_ADMIN_EMAIL = 'staff@hoc.com';
window.HOC_SINGLE_ADMIN_ID = 'STF-001';

window.hocIsSingleSystemAdmin = function (profileOrEmail, docId) {
  var em = typeof profileOrEmail === 'string' ? profileOrEmail : (profileOrEmail && profileOrEmail.email);
  if (em && String(em).toLowerCase() === String(window.HOC_SINGLE_ADMIN_EMAIL).toLowerCase()) return true;
  if (docId && String(docId) === window.HOC_SINGLE_ADMIN_ID) return true;
  if (profileOrEmail && profileOrEmail.employeeId === window.HOC_SINGLE_ADMIN_ID) return true;
  return false;
};

window.hocSyncPatientSession = function (profile, docId) {
  if (!profile) return;
  try {
    var pid = profile.patientId || docId || '';
    if (pid) localStorage.setItem('hoc_patient_id', pid);
    if (profile.name) localStorage.setItem('hoc_patient_name', profile.name);
    var s = {};
    try { s = JSON.parse(localStorage.getItem('hoc-patient-settings') || '{}'); } catch (e) { s = {}; }
    if (profile.name) s.name = profile.name;
    if (profile.email) s.email = profile.email;
    localStorage.setItem('hoc-patient-settings', JSON.stringify(s));
  } catch (e) {}
};

/** Firestore collection names — one role = one profile collection. */
window.HOC_COLLECTIONS = {
  patients: 'Patients',
  doctors: 'Doctors',
  staff: 'Staff',
  labTechnicians: 'LabTechnicians',
  appointments: 'Appointments',
  notifications: 'Notifications',
  userIndex: 'UserIndex',
  feedback: 'Feedback',
  chats: 'Chats'
};

window.hocProfileCollectionForRole = function (role) {
  var r = String(role || '');
  if (r === 'Patient') return window.HOC_COLLECTIONS.patients;
  if (r === 'Doctor') return window.HOC_COLLECTIONS.doctors;
  if (r === 'Staff') return window.HOC_COLLECTIONS.staff;
  if (r === 'Lab Technician') return window.HOC_COLLECTIONS.labTechnicians;
  return '';
};

/** Full profile data → role collection (Patients / Doctors / …). */
window.hocSaveProfileToCollection = function (db, collection, docId, data) {
  if (!db || !collection || !docId) return Promise.reject(new Error('Missing profile target'));
  return db.collection(collection).doc(String(docId)).set(data, { merge: true });
};

/** Login pointer only — NEVER store name/phone/CNIC here. Replaces doc to strip old junk fields. */
window.hocSaveUserIndexShared = function (db, uid, meta) {
  if (!db || !uid || !meta) return Promise.resolve();
  var row = {
    role: String(meta.role || ''),
    profileCollection: String(meta.profileCollection || ''),
    profileId: String(meta.profileId || ''),
    email: String(meta.email || '').toLowerCase(),
    updatedAt: new Date().toISOString()
  };
  return db.collection(window.HOC_COLLECTIONS.userIndex).doc(uid).set(row);
};

/**
 * Auth account exists but Firestore profile missing (failed registration or seed).
 * Never creates duplicate Patients — links uid to existing doc by uid/email first.
 */
window.hocRepairMissingLoginProfile = function (db, uid, email) {
  if (!db || !uid) return Promise.resolve(null);
  email = String(email || '').trim().toLowerCase();

  window._hocRepairInflight = window._hocRepairInflight || {};
  if (window._hocRepairInflight[uid]) return window._hocRepairInflight[uid];

  var authUser = null;
  try {
    if (typeof firebase !== 'undefined' && firebase.auth) authUser = firebase.auth().currentUser;
  } catch (eAuth) {}
  var authReady = (authUser && authUser.uid === uid && typeof window.hocEnsureFirestoreAuthReady === 'function')
    ? window.hocEnsureFirestoreAuthReady(db, authUser)
    : Promise.resolve(true);

  function finish(col, docId, data) {
    return window.hocSaveUserIndexShared(db, uid, {
      role: data.role,
      profileCollection: col,
      profileId: docId,
      email: data.email || email
    }).then(function () {
      return { data: data, docId: docId, repaired: true };
    });
  }

  function pickBestPatientDoc(docs) {
    var best = docs[0];
    docs.forEach(function (d) {
      var b = best.data();
      var c = d.data();
      var bScore = (b.phone ? 1 : 0) + (b.gender ? 1 : 0) + (b.bloodGroup ? 1 : 0) + (b.dob ? 1 : 0);
      var cScore = (c.phone ? 1 : 0) + (c.gender ? 1 : 0) + (c.bloodGroup ? 1 : 0) + (c.dob ? 1 : 0);
      if (cScore > bScore) best = d;
    });
    return best;
  }

  function linkPatientDoc(docSnap) {
    var data = docSnap.data() || {};
    var patch = Object.assign({}, data, {
      uid: uid,
      email: data.email || email,
      role: data.role || 'Patient',
      status: data.status || 'active',
      patientId: data.patientId || docSnap.id,
      shareRecords: data.shareRecords !== false
    });
    return db.collection(window.HOC_COLLECTIONS.patients).doc(docSnap.id).set(patch, { merge: true })
      .then(function () { return finish('Patients', docSnap.id, patch); });
  }

  function findExistingPatient() {
    return db.collection('Patients').where('uid', '==', uid).limit(1).get()
      .then(function (q) {
        if (!q.empty) return linkPatientDoc(q.docs[0]);
        if (!email) return null;
        return db.collection('Patients').where('email', '==', email).limit(10).get()
          .then(function (q2) {
            if (q2.empty) return null;
            return linkPatientDoc(pickBestPatientDoc(q2.docs));
          });
      })
      .catch(function (e) {
        if (e && e.code === 'permission-denied') return null;
        throw e;
      });
  }

  var job = authReady.then(function (ready) {
    if (ready === false) return { error: 'permission-denied', message: 'Firestore auth not ready' };
    return findExistingPatient();
  }).then(function (linked) {
    if (linked) return linked;

    if (window.hocIsSingleSystemAdmin && window.hocIsSingleSystemAdmin(email)) {
      var staffId = window.HOC_SINGLE_ADMIN_ID || 'STF-001';
      var staffRow = {
        name: 'Sarah Mitchell',
        firstName: 'Sarah',
        lastName: 'Mitchell',
        email: window.HOC_SINGLE_ADMIN_EMAIL,
        role: 'Staff',
        status: 'active',
        employeeId: staffId,
        uid: uid,
        department: 'Reception',
        designation: 'Administrator',
        phone: '0301-2345678',
        gender: 'Female',
        createdAt: new Date().toISOString()
      };
      return db.collection('Staff').doc(staffId).set(staffRow, { merge: true })
        .then(function () { return finish('Staff', staffId, staffRow); })
        .catch(function (e) { return { error: e.code || 'repair-failed', message: e.message }; });
    }

    if (email === 'patient@hoc.com') {
      var demoPatId = 'PAT-001';
      var patRow = {
        name: 'Emily Rodriguez',
        firstName: 'Emily',
        lastName: 'Rodriguez',
        email: 'patient@hoc.com',
        role: 'Patient',
        status: 'active',
        patientId: demoPatId,
        uid: uid,
        phone: '0333-5556789',
        gender: 'Female',
        bloodGroup: 'A+',
        shareRecords: true,
        createdAt: new Date().toISOString()
      };
      return db.collection('Patients').doc(demoPatId).set(patRow, { merge: true })
        .then(function () { return finish('Patients', demoPatId, patRow); })
        .catch(function (e) { return { error: e.code || 'repair-failed', message: e.message }; });
    }

    /* One skeleton per uid — no duplicate PAT-{timestamp} rows */
    var local = email.split('@')[0].replace(/[._+-]/g, ' ').trim() || 'Patient';
    var parts = local.split(/\s+/);
    var newId = 'PAT-' + uid.replace(/-/g, '').slice(0, 12).toUpperCase();
    var autoRow = {
      name: local,
      firstName: parts[0] || 'Patient',
      lastName: parts.slice(1).join(' ') || '',
      email: email,
      role: 'Patient',
      status: 'active',
      patientId: newId,
      uid: uid,
      shareRecords: true,
      createdAt: new Date().toISOString()
    };
    return db.collection('Patients').doc(newId).set(autoRow, { merge: true })
      .then(function () { return finish('Patients', newId, autoRow); })
      .catch(function (e) { return { error: e.code || 'repair-failed', message: e.message }; });
  }).finally(function () {
    delete window._hocRepairInflight[uid];
  });

  window._hocRepairInflight[uid] = job;
  return job;
};

/** UI preview for supervisor walkthrough — no login, no demo accounts. */
window.HOC_PORTAL_URLS = {
  patient: 'patient/Patient%20Dashboard%20Home%20Page%20p1.html',
  doctor: 'doc/doctor-dashboard%202.html',
  staff: 'staff/staff-dashboard.html',
  lab: 'lab%20tecinician/labtecinician.html'
};

window.hocIsPreviewMode = function () {
  /* Preview auth bypass locked — real Firebase login required on all portals. */
  return false;
};

window.hocEnableStaffPreview = function () {
  try { sessionStorage.setItem('hoc_staff_ui_preview', '1'); } catch (e) {}
};

window.hocIsStaffUiPreview = function () {
  try { return sessionStorage.getItem('hoc_staff_ui_preview') === '1'; } catch (e) { return false; }
};

window.hocEnablePreviewMode = function () {
  window.hocEnableStaffPreview();
};

window.hocClearPreviewMode = function () {
  try {
    localStorage.removeItem('hoc_preview');
    sessionStorage.removeItem('hoc_preview');
    sessionStorage.removeItem('hoc_staff_ui_preview');
  } catch (e) {}
};

/** Redirect to login if patient page opened without auth. */
window.HOC_guardPatientPage = function (redirect) {
  redirect = redirect || '../index.html';
  if (typeof firebase === 'undefined' || !firebase.auth) return;
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) window.location.replace(redirect);
  });
};

window.hocOpenPortal = function (which) {
  var base = window.HOC_PORTAL_URLS[which];
  if (!base) return;
  window.open(base, '_blank', 'noopener');
};

window.hocOpenAllPortals = function () {
  Object.keys(window.HOC_PORTAL_URLS).forEach(function (k) {
    window.open(window.HOC_PORTAL_URLS[k], '_blank', 'noopener');
  });
};

/** Canonical patient key for lab_* and pt_* chat rooms (PAT-001 → p1, etc.). */
window.hocNormalizePatientChatKey = function (pid) {
  if (!pid) {
    try { pid = localStorage.getItem('hoc_patient_id') || ''; } catch (e) {}
  }
  pid = String(pid || '').trim();
  if (!pid) return 'p1';
  var demoMap = { 'PAT-001': 'p1', 'PAT-002': 'p2', 'PAT-003': 'p3', 'PAT-004': 'p4', 'PAT-005': 'p5', 'PAT-006': 'p6' };
  if (demoMap[pid]) return demoMap[pid];
  if (/^PAT-/i.test(pid)) {
    var short = pid.replace(/^PAT-/i, 'p').replace(/[^a-zA-Z0-9]/g, '');
    return short || pid;
  }
  return pid;
};

/** All ids that refer to the same patient thread (profile doc id vs MRN). */
window.hocPatientChatKeys = function (pid) {
  if (!pid) {
    try { pid = localStorage.getItem('hoc_patient_id') || ''; } catch (e) {}
  }
  pid = String(pid || '').trim();
  var keys = [];
  if (pid) keys.push(pid);
  var norm = window.hocNormalizePatientChatKey(pid);
  if (norm && keys.indexOf(norm) < 0) keys.push(norm);
  return keys.filter(Boolean);
};

window.hocPatientIdsMatch = function (a, b) {
  if (!a || !b) return String(a || '') === String(b || '');
  if (String(a) === String(b)) return true;
  var ka = window.hocPatientChatKeys(a);
  var kb = window.hocPatientChatKeys(b);
  return ka.some(function (k) { return kb.indexOf(k) >= 0; });
};

window.hocGetDoctorChatRoomId = function (patientId, doctorId) {
  var pid = window.hocNormalizePatientChatKey(patientId);
  var did = String(doctorId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return 'pt_' + pid + '_doc_' + (did || 'unknown');
};

window.hocGetLabChatRoomId = function (patientId) {
  return 'lab_' + window.hocNormalizePatientChatKey(patientId);
};
