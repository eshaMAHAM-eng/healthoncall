/** Auto-init doctor bell on sub-pages (Patients, Settings, etc.) */
(function () {
  'use strict';

  window.HOC_bootstrapDoctorFirebase = function () {
    try {
      var cfg = window.HOC_FIREBASE_CONFIG || {};
      if (typeof firebase === 'undefined' || !cfg.apiKey) return false;
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      window._hocDb = window._hocDb || firebase.firestore();
      return true;
    } catch (e) {
      return false;
    }
  };

  window.HOC_initDoctorBell = function () {
    if (window._hocDoctorBellReady || typeof window.HOCNotifHub === 'undefined') return;
    if (!window.HOC_bootstrapDoctorFirebase()) return;
    if (!firebase.auth) return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user || window._hocDoctorBellReady) return;
      window._hocDb.collection('Doctors').where('uid', '==', user.uid).limit(1).get()
        .then(function (q) {
          if (q.empty || window._hocDoctorBellReady) return;
          var doc = q.docs[0];
          var d = doc.data();
          if (typeof window.hocRoleCanAccessDashboard === 'function' && !window.hocRoleCanAccessDashboard(d)) return;
          var did = d.doctorId || doc.id;
          window.HOC_DOCTOR_ID = did;
          try { localStorage.setItem('hoc_doctor_id', did); } catch (e) {}
          window.HOCNotifHub.init({
            db: window._hocDb,
            role: 'doctor',
            uid: user.uid,
            profileId: did,
            bellSelectors: ['.notif-btn', '.m-notif', '.mob-notif']
          });
          window._hocDoctorBellReady = true;
        })
        .catch(function () {});
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.HOC_initDoctorBell();
  });
})();
