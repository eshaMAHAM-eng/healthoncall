/**
 * HealthOnCall — Medical report upload (Firebase Storage) + Firestore metadata + consent.
 */
(function (global) {
  'use strict';

  function db() { return global._hocDb; }

  function storage() {
    if (!global._hocStorage && typeof firebase !== 'undefined' && firebase.storage) {
      try {
        var cfg = global.HOC_FIREBASE_CONFIG || {};
        if (!firebase.apps.length && cfg.apiKey) firebase.initializeApp(cfg);
        global._hocStorage = firebase.storage();
      } catch (e) {}
    }
    return global._hocStorage;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function fmtSize(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function fmtWhen(row) {
    try {
      if (row.uploadedAt && typeof row.uploadedAt.toDate === 'function') {
        return row.uploadedAt.toDate().toLocaleString();
      }
      if (row.uploadedAt && row.uploadedAt.seconds) {
        return new Date(row.uploadedAt.seconds * 1000).toLocaleString();
      }
    } catch (e) {}
    return '—';
  }

  global.HOCMedicalReports = {
    bootstrap: function () {
      if (typeof firebase === 'undefined') return false;
      var cfg = global.HOC_FIREBASE_CONFIG || {};
      if (!firebase.apps.length && cfg.apiKey) firebase.initializeApp(cfg);
      if (!global._hocDb) global._hocDb = firebase.firestore();
      return !!storage();
    },

    syncPatientConsent: function (patientDocId, shareRecords) {
      var d = db();
      if (!d || !patientDocId) return Promise.resolve();
      return d.collection('Patients').doc(patientDocId).set({
        shareRecords: !!shareRecords,
        privacyUpdatedAt: new Date().toISOString()
      }, { merge: true });
    },

    getPatientConsent: function (patientDocId) {
      var d = db();
      if (!d || !patientDocId) return Promise.resolve(global.HOCMedicalReports._localConsent());
      return d.collection('Patients').doc(patientDocId).get().then(function (snap) {
        if (!snap.exists) return global.HOCMedicalReports._localConsent();
        var v = snap.data().shareRecords;
        if (v === undefined) return global.HOCMedicalReports._localConsent();
        return !!v;
      }).catch(function () { return global.HOCMedicalReports._localConsent(); });
    },

    _localConsent: function () {
      try {
        var p = JSON.parse(localStorage.getItem('hoc-patient-privacy') || '{}');
        if (p['share-records'] === false) return false;
      } catch (e) {}
      return true;
    },

    uploadPatientReport: function (file, opts) {
      opts = opts || {};
      var st = storage();
      var d = db();
      if (!st || !d) return Promise.reject(new Error('Firebase Storage not available'));
      var patientId = opts.patientId || '';
      var patientUid = opts.patientUid || '';
      if (!patientId || !file) return Promise.reject(new Error('Missing patient or file'));
      if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('File must be under 10 MB'));

      var safeName = String(file.name || 'report').replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'medical_reports/' + patientId + '/' + Date.now() + '_' + safeName;
      var ref = st.ref(path);

      return ref.put(file).then(function () {
        return ref.getDownloadURL();
      }).then(function (url) {
        var row = {
          patientId: patientId,
          patientUid: patientUid,
          fileName: file.name,
          fileSize: file.size || 0,
          contentType: file.type || '',
          storagePath: path,
          downloadUrl: url,
          description: opts.description || '',
          appointmentId: opts.appointmentId || '',
          doctorId: opts.doctorId || '',
          consentGiven: opts.consentGiven !== false,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return d.collection('MedicalReports').add(row).then(function (docRef) {
          row.id = docRef.id;
          return row;
        });
      });
    },

    listPatientReports: function (patientId) {
      var d = db();
      if (!d || !patientId) return Promise.resolve([]);
      return d.collection('MedicalReports').where('patientId', '==', patientId).get().then(function (snap) {
        var arr = [];
        snap.forEach(function (doc) {
          var x = doc.data();
          x.id = doc.id;
          arr.push(x);
        });
        arr.sort(function (a, b) {
          var ta = a.uploadedAt && a.uploadedAt.toMillis ? a.uploadedAt.toMillis() : 0;
          var tb = b.uploadedAt && b.uploadedAt.toMillis ? b.uploadedAt.toMillis() : 0;
          return tb - ta;
        });
        return arr;
      });
    },

    listReportsForDoctor: function (patientId, doctorId) {
      doctorId = doctorId || '';
      if (!doctorId) {
        try { doctorId = localStorage.getItem('hoc_doctor_id') || ''; } catch (e) { doctorId = ''; }
      }
      return global.HOCMedicalReports.getPatientConsent(patientId).then(function (consent) {
        if (!consent) return { consent: false, reports: [], treating: false };
        var treating = typeof global.hocDoctorTreatsPatient === 'function'
          && global.hocDoctorTreatsPatient(patientId, doctorId);
        if (!treating) return { consent: true, reports: [], treating: false };
        return global.HOCMedicalReports.listPatientReports(patientId).then(function (reports) {
          return { consent: true, reports: reports, treating: true };
        });
      });
    },

    deleteReport: function (reportId, storagePath) {
      var d = db();
      var st = storage();
      var chain = Promise.resolve();
      if (st && storagePath) chain = st.ref(storagePath).delete().catch(function () {});
      return chain.then(function () {
        if (d && reportId) return d.collection('MedicalReports').doc(reportId).delete();
      });
    },

    renderPatientList: function (containerId, reports) {
      var el = document.getElementById(containerId);
      if (!el) return;
      if (!reports.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No medical reports uploaded yet</p><p class="sub">Upload lab reports, X-rays, or prescriptions (PDF/JPG/PNG)</p></div>';
        return;
      }
      var html = '';
      reports.forEach(function (r) {
        var icon = (r.contentType || '').indexOf('pdf') >= 0 || (r.fileName || '').toLowerCase().endsWith('.pdf')
          ? 'fa-file-pdf' : 'fa-file-image';
        html += '<div class="presc-row">';
        html += '<div class="presc-info"><div class="presc-icon"><i class="fas ' + icon + '"></i></div>';
        html += '<div class="presc-text"><div class="pt-name">' + esc(r.fileName) + '</div>';
        html += '<div class="pt-doc">' + fmtSize(r.fileSize) + ' &bull; ' + fmtWhen(r);
        if (r.description) html += ' &bull; ' + esc(r.description);
        html += '</div></div></div>';
        html += '<div style="display:flex;gap:6px;">';
        html += '<a class="btn btn-view" href="' + escAttr(r.downloadUrl) + '" target="_blank" rel="noopener"><i class="fas fa-download"></i> Open</a>';
        html += '<button type="button" class="btn btn-view" style="background:#fff1f2;color:#be123c;border-color:#fecdd3;" onclick="hocDeleteMedicalReport(\'' + escAttr(r.id) + '\',\'' + escAttr(r.storagePath || '') + '\')"><i class="fas fa-trash"></i></button>';
        html += '</div></div>';
      });
      el.innerHTML = html.replace(/<div class="presc-icon">/g, '<div class="presc-icon">').replace(/<\/div>/g, '</div>');
    },

    renderDoctorPanel: function (containerId, result) {
      var el = document.getElementById(containerId);
      if (!el) return;
      if (!result.consent) {
        el.innerHTML = '<div style="padding:14px 16px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.5;"><i class="fas fa-lock" style="margin-right:6px;"></i>Patient has <strong>disabled</strong> medical record sharing. Reports are hidden until consent is enabled in patient Settings.</div>';
        return;
      }
      if (result.treating === false) {
        el.innerHTML = '<div style="padding:14px 16px;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:13px;line-height:1.5;"><i class="fas fa-user-shield" style="margin-right:6px;color:#059669;"></i>Medical reports are only shown for <strong>your own patients</strong> (booked with you).</div>';
        return;
      }
      if (!result.reports.length) {
        el.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--text-muted);">No uploaded medical reports for this patient.</div>';
        return;
      }
      var html = '<div style="font-size:11px;font-weight:700;color:var(--accent-dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;"><i class="fas fa-file-medical" style="margin-right:6px;"></i>Patient uploaded reports (consent granted)</div>';
      result.reports.forEach(function (r) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">';
        html += '<i class="fas fa-file-alt" style="color:var(--accent);"></i>';
        html += '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(r.fileName) + '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);">' + fmtSize(r.fileSize) + ' &bull; ' + fmtWhen(r) + '</div></div>';
        html += '<a href="' + escAttr(r.downloadUrl) + '" target="_blank" rel="noopener" class="btn" style="font-size:11px;padding:6px 12px;"><i class="fas fa-external-link-alt"></i> View</a></div>';
      });
      el.innerHTML = html.replace(/<\/div>/g, '</div>');
    }
  };
})(window);
