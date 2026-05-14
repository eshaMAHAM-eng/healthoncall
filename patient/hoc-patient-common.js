/**
 * HealthOnCall patient portal — shared theme + identity helpers.
 * Include after <body> on every patient HTML page, then call HOC_applyThemeFromStorage().
 */
(function () {
  function parseSettings() {
    try {
      var raw = localStorage.getItem('hoc-patient-settings');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function ensurePatientId() {
    var id = localStorage.getItem('hoc_patient_id');
    if (id && String(id).trim()) return String(id).trim();
    try {
      var u = JSON.parse(localStorage.getItem('hoc_user') || '{}');
      if (u.patientId && String(u.patientId).trim()) return String(u.patientId).trim();
    } catch (e) {}
    return '';
  }

  window.HOC_getPatientId = function () {
    var id = ensurePatientId();
    if (id) return id;
    return 'p1';
  };

  window.HOC_getPatientName = function () {
    var s = parseSettings();
    if (s.name && String(s.name).trim()) return s.name.trim();
    var n = localStorage.getItem('hoc_patient_name');
    if (n && String(n).trim()) return n.trim();
    return 'Patient';
  };

  /** Resolve logged-in patient id/uid from Firestore before booking or queries. */
  window.HOC_resolvePatientContext = function () {
    return new Promise(function (resolve) {
      var fallback = function (extra) {
        resolve(Object.assign({
          patientId: window.HOC_getPatientId(),
          patientUid: '',
          patientName: window.HOC_getPatientName(),
          needsLogin: false,
          needsProfile: false
        }, extra || {}));
      };
      if (!window._hocDb && !window.HOC_bootstrapPatientFirebase()) {
        fallback();
        return;
      }
      if (typeof firebase === 'undefined' || !firebase.auth) {
        fallback();
        return;
      }
      var done = false;
      var unsub = firebase.auth().onAuthStateChanged(function (user) {
        if (done) return;
        done = true;
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
        if (!user) {
          fallback({ patientId: '', patientUid: '', needsLogin: true });
          return;
        }
        window._hocDb.collection('Patients').where('uid', '==', user.uid).limit(1).get()
          .then(function (q) {
            if (!q.empty) {
              var doc = q.docs[0];
              var d = doc.data();
              if (typeof window.hocSyncPatientSession === 'function') window.hocSyncPatientSession(d, doc.id);
              resolve({
                patientId: d.patientId || doc.id,
                patientUid: user.uid,
                patientName: d.name || window.HOC_getPatientName(),
                needsLogin: false,
                needsProfile: false
              });
              return;
            }
            if (user.email) {
              return window._hocDb.collection('Patients').where('email', '==', String(user.email).trim().toLowerCase()).limit(5).get()
                .then(function (qEmail) {
                  if (!qEmail.empty) {
                    var pick = qEmail.docs[0];
                    qEmail.docs.forEach(function (d) {
                      var b = pick.data(), c = d.data();
                      var bs = (b.phone ? 1 : 0) + (b.gender ? 1 : 0) + (b.dob ? 1 : 0);
                      var cs = (c.phone ? 1 : 0) + (c.gender ? 1 : 0) + (c.dob ? 1 : 0);
                      if (cs > bs) pick = d;
                    });
                    var patch = Object.assign({}, pick.data(), { uid: user.uid });
                    return window._hocDb.collection('Patients').doc(pick.id).set(patch, { merge: true })
                      .then(function () {
                        if (typeof window.hocSyncPatientSession === 'function') window.hocSyncPatientSession(patch, pick.id);
                        resolve({
                          patientId: patch.patientId || pick.id,
                          patientUid: user.uid,
                          patientName: patch.name || window.HOC_getPatientName(),
                          needsLogin: false,
                          needsProfile: false
                        });
                      });
                  }
                  if (typeof window.hocRepairMissingLoginProfile === 'function') {
                    return window.hocRepairMissingLoginProfile(window._hocDb, user.uid, user.email || '').then(function (repaired) {
                      if (repaired && repaired.data) {
                        if (typeof window.hocSyncPatientSession === 'function') window.hocSyncPatientSession(repaired.data, repaired.docId);
                        resolve({
                          patientId: repaired.data.patientId || repaired.docId,
                          patientUid: user.uid,
                          patientName: repaired.data.name || window.HOC_getPatientName(),
                          needsLogin: false,
                          needsProfile: false
                        });
                        return;
                      }
                      fallback({ patientUid: user.uid, needsProfile: true });
                    });
                  }
                  fallback({ patientUid: user.uid, needsProfile: true });
                });
            }
            if (typeof window.hocRepairMissingLoginProfile === 'function') {
              return window.hocRepairMissingLoginProfile(window._hocDb, user.uid, user.email || '').then(function (repaired) {
                if (repaired && repaired.data) {
                  if (typeof window.hocSyncPatientSession === 'function') window.hocSyncPatientSession(repaired.data, repaired.docId);
                  resolve({
                    patientId: repaired.data.patientId || repaired.docId,
                    patientUid: user.uid,
                    patientName: repaired.data.name || window.HOC_getPatientName(),
                    needsLogin: false,
                    needsProfile: false
                  });
                  return;
                }
                fallback({ patientUid: user.uid, needsProfile: true });
              });
            }
            fallback({ patientUid: user.uid, needsProfile: true });
          })
          .catch(function () {
            fallback({ patientUid: user.uid });
          });
      });
    });
  };

  window.HOC_getLocalAppointments = function () {
    var list = [];
    try {
      if (typeof window.AppStorage !== 'undefined' && window.AppStorage.appointments && window.AppStorage.appointments.length) {
        return window.AppStorage.appointments.slice();
      }
    } catch (e0) {}
    try { list = JSON.parse(localStorage.getItem('hoc_appointments') || '[]'); } catch (e1) { list = []; }
    return Array.isArray(list) ? list : [];
  };

  window.HOC_subscribePatientAppointments = function (opts) {
    opts = opts || {};
    var onData = opts.onData || function () {};
    var onErr = opts.onErr || function () {};
    if (!window._hocDb && !window.HOC_bootstrapPatientFirebase()) return function () {};
    if (typeof firebase === 'undefined' || !firebase.auth) return function () {};
    var unsubs = [];
    var merged = {};
    var emit = function (ctx) {
      var localOnly = [];
      window.HOC_getLocalAppointments().forEach(function (a) {
        if (!a || !a.id) return;
        if (!merged[a.id]) {
          merged[a.id] = a;
          localOnly.push(a);
        }
      });
      var publish = function () {
        var apts = Object.keys(merged).map(function (k) { return merged[k]; });
        apts.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
        onData(apts, ctx);
      };
      publish();
      if (localOnly.length && typeof window.HOC_pushAppointmentToCloud === 'function') {
        Promise.all(localOnly.map(function (a) {
          return window.HOC_pushAppointmentToCloud(a, ctx).catch(function (err) {
            console.warn('Auto-sync appointment to staff:', a.id, err);
            return null;
          });
        })).then(function (rows) {
          var changed = false;
          rows.forEach(function (row) {
            if (row && row.id) { merged[row.id] = row; changed = true; }
          });
          if (changed) publish();
        });
      }
    };
    var ingest = function (snap, ctx) {
      snap.forEach(function (d) {
        var data = d.data();
        if (!data.id) data.id = d.id;
        if (!data.appointmentId) data.appointmentId = data.id || d.id;
        merged[d.id] = data;
      });
      emit(ctx);
    };
    var authUnsub = firebase.auth().onAuthStateChanged(function (user) {
      unsubs.forEach(function (u) { try { u(); } catch (e) {} });
      unsubs = [];
      merged = {};
      if (!user) return;
      window.HOC_resolvePatientContext().then(function (ctx) {
        if (!ctx.patientUid && !ctx.patientId) return;
        if (ctx.patientUid) {
          unsubs.push(window._hocDb.collection('Appointments').where('patientUid', '==', ctx.patientUid)
            .onSnapshot(function (snap) { ingest(snap, ctx); }, onErr));
        }
        if (ctx.patientId) {
          unsubs.push(window._hocDb.collection('Appointments').where('patientId', '==', ctx.patientId)
            .onSnapshot(function (snap) { ingest(snap, ctx); }, onErr));
        }
      });
    });
    return function () {
      unsubs.forEach(function (u) { try { u(); } catch (e) {} });
      try { if (typeof authUnsub === 'function') authUnsub(); } catch (e2) {}
    };
  };

  /** Push browser-only appointments to Firestore (recovery after login). */
  window.HOC_normalizeAppointmentRow = function (a, ctx) {
    ctx = ctx || {};
    if (!a || !a.id) return null;
    var row = Object.assign({}, a);
    row.appointmentId = row.appointmentId || row.id;
    row.patientId = ctx.patientId || row.patientId || '';
    row.patientUid = ctx.patientUid || row.patientUid || '';
    row.patientName = ctx.patientName || row.patientName || '';
    if (!row.status || row.status === 'Pending') row.status = 'requested';
    return row;
  };

  window.HOC_pushAppointmentToCloud = function (apt, ctx) {
    if (!window._hocDb && !window.HOC_bootstrapPatientFirebase()) {
      return Promise.reject(new Error('Firebase not connected'));
    }
    return (ctx ? Promise.resolve(ctx) : window.HOC_resolvePatientContext()).then(function (c) {
      var row = window.HOC_normalizeAppointmentRow(apt, c);
      if (!row) return Promise.reject(new Error('Invalid appointment'));
      var enrich = (typeof window.hocEnrichAppointmentForCloud === 'function')
        ? window.hocEnrichAppointmentForCloud(window._hocDb, row)
        : Promise.resolve(row);
      return enrich.then(function (enriched) {
        return window._hocDb.collection(window.HOC_COLLECTIONS.appointments || 'Appointments').doc(enriched.id).set(enriched, { merge: true }).then(function () {
          return enriched;
        });
      });
    });
  };

  window.HOC_syncLocalAppointmentsToFirestore = function () {
    return window.HOC_resolvePatientContext().then(function (ctx) {
      if (ctx.needsLogin || !window._hocDb) return { synced: 0, failed: 0, errors: [] };
      var local = window.HOC_getLocalAppointments();
      if (!local.length) return { synced: 0, failed: 0, errors: [] };
      return Promise.all(local.map(function (a) {
        return window.HOC_pushAppointmentToCloud(a, ctx)
          .then(function () { return { ok: true }; })
          .catch(function (err) {
            console.warn('Sync appointment failed:', a && a.id, err);
            return { ok: false, err: err && (err.message || err.code) || 'unknown' };
          });
      })).then(function (rs) {
        var synced = rs.filter(function (r) { return r.ok; }).length;
        var errors = rs.filter(function (r) { return !r.ok; }).map(function (r) { return r.err; });
        return { synced: synced, failed: rs.length - synced, errors: errors };
      });
    });
  };

  window.HOC_applyThemeFromStorage = function () {
    var s = parseSettings();
    if (s.theme === 'system') {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      return;
    }
    if (s.dark === true || s.theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  window.HOC_getGoogleMapsKey = function () {
    return localStorage.getItem('hoc_google_maps_key') || '';
  };

  window.HOC_bootstrapPatientFirebase = function () {
    try {
      var cfg = window.HOC_FIREBASE_CONFIG || {};
      if (typeof firebase === 'undefined' || !cfg.apiKey) return false;
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      window._hocDb = firebase.firestore();
      if (firebase.storage) window._hocStorage = firebase.storage();
      window._hocFirebaseInit = true;
      return true;
    } catch (e) {
      return false;
    }
  };

  window.HOC_initPatientBell = function () {
    if (window._hocPatientBellReady || typeof window.HOCNotifHub === 'undefined') return;
    if (!window._hocDb && !window.HOC_bootstrapPatientFirebase()) return;
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user || window._hocPatientBellReady) return;
      window._hocDb.collection('Patients').where('uid', '==', user.uid).limit(1).get()
        .then(function (q) {
          if (q.empty || window._hocPatientBellReady) return;
          var doc = q.docs[0];
          var d = doc.data();
          if (typeof window.hocSyncPatientSession === 'function') window.hocSyncPatientSession(d, doc.id);
          window.HOCNotifHub.init({
            db: window._hocDb,
            role: 'patient',
            uid: user.uid,
            profileId: d.patientId || doc.id,
            bellSelectors: ['.notif-btn', '.m-notif']
          });
          window._hocPatientBellReady = true;
        })
        .catch(function () {});
    });
  };

  if (!window.markNotifRead) {
    window.markNotifRead = function () {
      if (typeof window.HOCNotifHub !== 'undefined' && typeof window.HOCNotifHub.markNotifRead === 'function') {
        window.HOCNotifHub.markNotifRead();
      } else if (typeof window.HOCNotifHub !== 'undefined') {
        window.HOCNotifHub.markAllRead();
      }
    };
  }

  function hocApplyPatientUIFromStorage() {
    if (typeof window.hocApplyPatientProfileUI === 'function') {
      window.hocApplyPatientProfileUI({ name: window.HOC_getPatientName() });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    hocApplyPatientUIFromStorage();
    window.HOC_initPatientBell();
    if (typeof window.HOC_guardPatientPage === 'function') window.HOC_guardPatientPage();
  });

  window.addEventListener('storage', function (ev) {
    if (ev.key === 'hoc_patient_name' || ev.key === 'hoc-patient-settings') hocApplyPatientUIFromStorage();
  });
})();
