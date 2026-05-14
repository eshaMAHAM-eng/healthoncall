/** HealthOnCall — 2 active doctors per booking service (Firestore seed + patient load). */
(function (global) {
  'use strict';

  var SERVICES = global.HOC_SERVICE_IDS || [
    'Home Nursing', 'Physiotherapy', 'Lab Tests',
    'Speech Therapy', 'General Physician', 'Psychologist'
  ];

  global.HOC_BOOKING_DOCTOR_PASSWORD = 'hocdoc123';

  global.HOC_BOOKING_DOCTOR_PROFILES = [
    { doctorId: 'DOC-HN-01', name: 'Dr. Asma Naz', service: 'Home Nursing', specialization: 'Home Nursing', department: 'Home Nursing', qualification: 'BS Nursing, RN', licenseNumber: 'HON-PK-001', experience: '8', fee: 1200, phone: '03001234567', email: 'asma.naz@healthoncall.demo', gender: 'Female', address: 'Kohinoor City, Faisalabad', area: 'Kohinoor City', lat: 31.4504, lng: 73.1350 },
    { doctorId: 'DOC-HN-02', name: 'Dr. Nadia Fatima', service: 'Home Nursing', specialization: 'Home Nursing', department: 'Home Nursing', qualification: 'MSc Nursing', licenseNumber: 'HON-PK-002', experience: '5', fee: 1000, phone: '03219876543', email: 'nadia.fatima@healthoncall.demo', gender: 'Female', address: 'Madina Town, Faisalabad', area: 'Madina Town', lat: 31.4180, lng: 73.0790 },
    { doctorId: 'DOC-PT-01', name: 'Dr. Zain Ahmed', service: 'Physiotherapy', specialization: 'Physiotherapy', department: 'Physiotherapy', qualification: 'DPT, MS Orthopedics', licenseNumber: 'PHY-PK-001', experience: '10', fee: 1800, phone: '03009876543', email: 'zain.ahmed@healthoncall.demo', gender: 'Male', address: 'D-Ground, Faisalabad', area: 'D-Ground', lat: 31.4600, lng: 73.1100 },
    { doctorId: 'DOC-PT-02', name: 'Dr. Sara Malik', service: 'Physiotherapy', specialization: 'Physiotherapy', department: 'Physiotherapy', qualification: 'DPT', licenseNumber: 'PHY-PK-002', experience: '6', fee: 1500, phone: '03335556789', email: 'sara.malik@healthoncall.demo', gender: 'Female', address: 'Peoples Colony, Faisalabad', area: 'Peoples Colony', lat: 31.4350, lng: 73.0950 },
    { doctorId: 'DOC-ST-01', name: 'Dr. Fatima Noor', service: 'Speech Therapy', specialization: 'Speech Therapy', department: 'Speech Therapy', qualification: 'MS Speech Language Pathology', licenseNumber: 'SP-PK-001', experience: '8', fee: 1500, phone: '03335556789', email: 'fatima.noor@healthoncall.demo', gender: 'Female', address: 'Madina Town, Faisalabad', area: 'Madina Town', lat: 31.4200, lng: 73.0820 },
    { doctorId: 'DOC-ST-02', name: 'Dr. Usman Tariq', service: 'Speech Therapy', specialization: 'Speech Therapy', department: 'Speech Therapy', qualification: 'BS SLP', licenseNumber: 'SP-PK-002', experience: '5', fee: 1300, phone: '03217778899', email: 'usman.tariq@healthoncall.demo', gender: 'Male', address: 'Jinnah Colony, Faisalabad', area: 'Jinnah Colony', lat: 31.4280, lng: 73.1000 },
    { doctorId: 'DOC-GP-01', name: 'Dr. Ahmed Raza', service: 'General Physician', specialization: 'General Medicine', department: 'General Physician', qualification: 'MBBS, FCPS', licenseNumber: 'GP-PK-001', experience: '15', fee: 1500, phone: '03012345678', email: 'ahmed.raza@healthoncall.demo', gender: 'Male', address: 'D-Ground, Faisalabad', area: 'D-Ground', lat: 31.4580, lng: 73.1080 },
    { doctorId: 'DOC-GP-02', name: 'Dr. Maria Iqbal', service: 'General Physician', specialization: 'Family Medicine', department: 'General Physician', qualification: 'MBBS, MCPS', licenseNumber: 'GP-PK-002', experience: '11', fee: 1400, phone: '03112223344', email: 'maria.iqbal@healthoncall.demo', gender: 'Female', address: 'Canal Road, Faisalabad', area: 'Canal Road', lat: 31.4480, lng: 73.1420 },
    { doctorId: 'DOC-PS-01', name: 'Dr. Sana Khan', service: 'Psychologist', specialization: 'Clinical Psychology', department: 'Psychologist', qualification: 'MS Clinical Psychology', licenseNumber: 'PSY-PK-001', experience: '8', fee: 2000, phone: '03001234567', email: 'sana.khan@healthoncall.demo', gender: 'Female', address: 'Kohinoor City, Faisalabad', area: 'Kohinoor City', lat: 31.4510, lng: 73.1360 },
    { doctorId: 'DOC-PS-02', name: 'Dr. Hassan Ali', service: 'Psychologist', specialization: 'Counseling Psychology', department: 'Psychologist', qualification: 'MS Psychology, CBT', licenseNumber: 'PSY-PK-002', experience: '6', fee: 1800, phone: '03219876543', email: 'hassan.ali@healthoncall.demo', gender: 'Male', address: 'Madina Town, Faisalabad', area: 'Madina Town', lat: 31.4190, lng: 73.0800 }
  ];

  /** Lab staff — LabTechnicians collection (NOT Doctors). Login → lab portal. */
  global.HOC_BOOKING_LAB_PROFILES = [
    { labTechId: 'LAB-LB-01', name: 'Kamran Shahid', service: 'Lab Tests', labDepartment: 'Clinical Pathology', labDesignation: 'Senior Lab Technician', qualification: 'MBBS, DCP', labLicenseId: 'LAB-PK-001', labExperience: '12', phone: '03001112233', email: 'kamran.shahid@healthoncall.demo', gender: 'Male' },
    { labTechId: 'LAB-LB-02', name: 'Ayesha Siddiqui', service: 'Lab Tests', labDepartment: 'Hematology', labDesignation: 'Lab Technician', qualification: 'MBBS, FCPS Pathology', labLicenseId: 'LAB-PK-002', labExperience: '9', phone: '03004445566', email: 'ayesha.siddiqui@healthoncall.demo', gender: 'Female' }
  ];

  global.hocNormalizeBookingService = function (d) {
    if (!d) return '';
    var fields = [d.service, d.specialization, d.department, d.designation];
    for (var i = 0; i < fields.length; i++) {
      var s = String(fields[i] || '').trim();
      if (SERVICES.indexOf(s) >= 0) return s;
    }
    if (typeof global.hocMapToService === 'function') {
      var mapped = global.hocMapToService(d.service || d.specialization || d.department || '');
      if (SERVICES.indexOf(mapped) >= 0) return mapped;
    }
    return '';
  };

  global.hocFirestoreDoctorToCard = function (docSnap) {
    var d = docSnap.data() || {};
    if (typeof global.hocIsMisclassifiedLabDoctor === 'function' && global.hocIsMisclassifiedLabDoctor(d)) return null;
    var svc = global.hocNormalizeBookingService(d);
    if (!svc || svc === 'Lab Tests') return null;
    var lat = parseFloat(d.lat);
    var lng = parseFloat(d.lng);
    if (isNaN(lat)) lat = 31.4504 + (Math.random() * 0.04 - 0.02);
    if (isNaN(lng)) lng = 73.1350 + (Math.random() * 0.04 - 0.02);
    return {
      id: docSnap.id,
      doctorId: d.doctorId || docSnap.id,
      name: d.name || 'Doctor',
      specialty: d.specialization || d.designation || svc,
      service: svc,
      experience: (d.experience ? d.experience + ' Years' : 'N/A'),
      fee: parseInt(d.fee, 10) || 1000,
      rating: typeof d.rating === 'number' ? d.rating : 4.8,
      patients: d.patients || '100+',
      visitType: d.visitType || 'Both',
      area: d.area || d.address || 'Faisalabad',
      lat: lat,
      lng: lng,
      available: d.status === 'active',
      phone: d.phone || '',
      qualification: d.qualification || 'MBBS',
      about: d.about || 'Verified specialist on HealthOnCall.'
    };
  };

  global.hocProfileToCard = function (p) {
    return {
      id: p.doctorId,
      doctorId: p.doctorId,
      name: p.name,
      specialty: p.specialization || p.service,
      service: p.service,
      experience: (p.experience ? p.experience + ' Years' : 'N/A'),
      fee: parseInt(p.fee, 10) || 1000,
      rating: 4.8,
      patients: '100+',
      visitType: 'Both',
      area: p.area || p.address || 'Faisalabad',
      lat: p.lat || 31.4504,
      lng: p.lng || 73.1350,
      available: true,
      phone: p.phone || '',
      qualification: p.qualification || '',
      about: 'HealthOnCall specialist.'
    };
  };

  global.hocEnsureBookingDoctors = function (db) {
    if (!db || !global.HOC_BOOKING_DOCTOR_PROFILES) return Promise.resolve(0);
    var ts = typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();
    return Promise.all(global.HOC_BOOKING_DOCTOR_PROFILES.map(function (p) {
      var id = p.doctorId;
      var row = {
        name: p.name,
        firstName: p.name.replace(/^Dr\.\s*/, '').split(' ')[0],
        lastName: p.name.replace(/^Dr\.\s*/, '').split(' ').slice(1).join(' ') || '',
        email: p.email,
        phone: p.phone,
        gender: p.gender || '',
        role: 'Doctor',
        status: 'active',
        verified: true,
        service: p.service,
        specialization: p.specialization,
        department: p.department || p.service,
        qualification: p.qualification,
        licenseNumber: p.licenseNumber,
        experience: p.experience,
        fee: p.fee,
        address: p.address,
        area: p.area,
        lat: p.lat,
        lng: p.lng,
        doctorId: id,
        createdAt: ts
      };
      return db.collection('Doctors').doc(id).set(row, { merge: true });
    })).then(function () { return global.HOC_BOOKING_DOCTOR_PROFILES.length; }).catch(function (e) {
      console.warn('hocEnsureBookingDoctors', e);
      return 0;
    });
  };

  global.hocEnsureBookingLabTechnicians = function (db) {
    if (!db || !global.HOC_BOOKING_LAB_PROFILES) return Promise.resolve(0);
    var ts = typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();
    return Promise.all(global.HOC_BOOKING_LAB_PROFILES.map(function (p) {
      var id = p.labTechId;
      var parts = String(p.name || '').split(/\s+/);
      var row = {
        name: p.name,
        firstName: parts[0] || p.name,
        lastName: parts.slice(1).join(' ') || '',
        email: p.email,
        phone: p.phone,
        gender: p.gender || '',
        role: 'Lab Technician',
        status: 'active',
        verified: true,
        service: p.service || 'Lab Tests',
        labDepartment: p.labDepartment || 'Lab Tests',
        labDesignation: p.labDesignation || 'Lab Technician',
        qualification: p.qualification || '',
        labLicenseId: p.labLicenseId || '',
        labExperience: p.labExperience || '',
        labTechId: id,
        createdAt: ts
      };
      return db.collection('LabTechnicians').doc(id).set(row, { merge: true });
    })).then(function () { return global.HOC_BOOKING_LAB_PROFILES.length; }).catch(function (e) {
      console.warn('hocEnsureBookingLabTechnicians', e);
      return 0;
    });
  };

  global.hocMigrateLabDoctorsToLabTechs = function (db) {
    if (!db) return Promise.resolve(0);
    return db.collection('Doctors').get().then(function (snap) {
      var tasks = [];
      snap.forEach(function (docSnap) {
        var d = docSnap.data() || {};
        if (typeof global.hocIsMisclassifiedLabDoctor === 'function' && !global.hocIsMisclassifiedLabDoctor(d)) return;
        var oldId = docSnap.id;
        var labTechId = String(d.labTechId || String(d.doctorId || oldId).replace(/^DOC-/, 'LAB-'));
        var parts = String(d.name || '').replace(/^Dr\.\s*/i, '').split(/\s+/);
        var labRow = {
          name: String(d.name || '').replace(/^Dr\.\s*/i, '').trim() || d.name,
          firstName: d.firstName || parts[0] || '',
          lastName: d.lastName || parts.slice(1).join(' ') || '',
          email: d.email || '',
          phone: d.phone || '',
          gender: d.gender || '',
          role: 'Lab Technician',
          status: d.status || 'active',
          verified: d.verified !== false,
          uid: d.uid || '',
          service: 'Lab Tests',
          labDepartment: d.department || d.specialization || 'Lab Tests',
          labDesignation: d.specialization || d.labDesignation || 'Lab Technician',
          labLicenseId: d.licenseNumber || d.labLicenseId || '',
          labExperience: d.experience || d.labExperience || '',
          qualification: d.qualification || '',
          labTechId: labTechId,
          migratedFromDoctorId: oldId
        };
        tasks.push(
          db.collection('LabTechnicians').doc(labTechId).set(labRow, { merge: true }).then(function () {
            if (d.uid && typeof global.hocSaveUserIndexShared === 'function') {
              return global.hocSaveUserIndexShared(db, d.uid, {
                role: 'Lab Technician',
                profileCollection: 'LabTechnicians',
                profileId: labTechId,
                email: d.email || ''
              });
            }
          }).then(function () {
            return db.collection('Doctors').doc(oldId).delete();
          })
        );
      });
      return Promise.all(tasks).then(function () { return tasks.length; });
    }).catch(function (e) {
      console.warn('hocMigrateLabDoctorsToLabTechs', e);
      return 0;
    });
  };

  /** Creates Firebase Auth + links uid on each booking doctor (run once from staff init). */
  global.hocEnsureBookingDoctorLogins = function (db, config) {
    if (!db || !global.HOC_BOOKING_DOCTOR_PROFILES || typeof firebase === 'undefined') {
      return Promise.resolve(0);
    }
    var sk = 'hoc_booking_doc_auth_v2';
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(sk)) {
        return Promise.resolve(0);
      }
    } catch (e) { /* ignore */ }

    var cfg = config || (typeof firebase !== 'undefined' && firebase.app ? firebase.app().options : {});
    var secAuth;
    try {
      var appName = 'HocBookingDoctorSeed';
      try { secAuth = firebase.auth(firebase.app(appName)); }
      catch (e1) { secAuth = firebase.auth(firebase.initializeApp(cfg, appName)); }
    } catch (e2) {
      console.warn('hocEnsureBookingDoctorLogins: secondary auth unavailable', e2);
      return Promise.resolve(0);
    }

    var pw = global.HOC_BOOKING_DOCTOR_PASSWORD || 'hocdoc123';

    function linkUid(profile, uid) {
      return db.collection('Doctors').doc(profile.doctorId).set({
        uid: uid,
        email: profile.email,
        status: 'active',
        verified: true,
        role: 'Doctor',
        doctorId: profile.doctorId
      }, { merge: true });
    }

    function ensureOne(p) {
      return new Promise(function (resolve) {
        secAuth.createUserWithEmailAndPassword(p.email, pw).then(function (cr) {
          var uid = cr.user.uid;
          return secAuth.signOut().then(function () { return linkUid(p, uid); });
        }).then(function () { resolve(1); }).catch(function (err) {
          if (err && err.code === 'auth/email-already-in-use') {
            secAuth.signInWithEmailAndPassword(p.email, pw).then(function (si) {
              var uid = si.user.uid;
              return secAuth.signOut().then(function () { return linkUid(p, uid); });
            }).then(function () { resolve(1); }).catch(function (e3) {
              console.warn('Booking doctor login link failed:', p.email, e3 && (e3.code || e3.message));
              resolve(0);
            });
          } else {
            console.warn('Booking doctor auth create failed:', p.email, err && (err.code || err.message));
            resolve(0);
          }
        });
      });
    }

    return Promise.all(global.HOC_BOOKING_DOCTOR_PROFILES.map(ensureOne)).then(function (counts) {
      var n = counts.reduce(function (a, b) { return a + b; }, 0);
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(sk, '1'); } catch (e) { /* ignore */ }
      return n;
    });
  };

  global.hocEnsureBookingLabLogins = function (db, config) {
    if (!db || !global.HOC_BOOKING_LAB_PROFILES || typeof firebase === 'undefined') {
      return Promise.resolve(0);
    }
    var sk = 'hoc_booking_lab_auth_v2';

    var cfg = config || (typeof firebase !== 'undefined' && firebase.app ? firebase.app().options : {});
    var secAuth;
    try {
      var appName = 'HocBookingLabSeed';
      try { secAuth = firebase.auth(firebase.app(appName)); }
      catch (e1) { secAuth = firebase.auth(firebase.initializeApp(cfg, appName)); }
    } catch (e2) {
      console.warn('hocEnsureBookingLabLogins: secondary auth unavailable', e2);
      return Promise.resolve(0);
    }

    var pw = global.HOC_BOOKING_DOCTOR_PASSWORD || 'hocdoc123';

    function linkLabUid(profile, uid) {
      return db.collection('LabTechnicians').doc(profile.labTechId).set({
        uid: uid,
        email: profile.email,
        status: 'active',
        verified: true,
        role: 'Lab Technician',
        labTechId: profile.labTechId
      }, { merge: true }).then(function () {
        if (typeof global.hocSaveUserIndexShared === 'function') {
          return global.hocSaveUserIndexShared(db, uid, {
            role: 'Lab Technician',
            profileCollection: 'LabTechnicians',
            profileId: profile.labTechId,
            email: profile.email
          });
        }
      });
    }

    function ensureLabOne(p) {
      return new Promise(function (resolve) {
        secAuth.createUserWithEmailAndPassword(p.email, pw).then(function (cr) {
          var uid = cr.user.uid;
          return secAuth.signOut().then(function () { return linkLabUid(p, uid); });
        }).then(function () { resolve(1); }).catch(function (err) {
          if (err && err.code === 'auth/email-already-in-use') {
            secAuth.signInWithEmailAndPassword(p.email, pw).then(function (si) {
              var uid = si.user.uid;
              return secAuth.signOut().then(function () { return linkLabUid(p, uid); });
            }).then(function () { resolve(1); }).catch(function (e3) {
              console.warn('Booking lab login link failed:', p.email, e3 && (e3.code || e3.message));
              resolve(0);
            });
          } else {
            console.warn('Booking lab auth create failed:', p.email, err && (err.code || err.message));
            resolve(0);
          }
        });
      });
    }

    return Promise.all(global.HOC_BOOKING_LAB_PROFILES.map(ensureLabOne)).then(function (counts) {
      var n = counts.reduce(function (a, b) { return a + b; }, 0);
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(sk, '1'); } catch (e) { /* ignore */ }
      return n;
    });
  };

  global.hocLoadBookingDoctors = function (db, localFallback) {
    if (!db) {
      return Promise.resolve((localFallback || global.HOC_BOOKING_DOCTOR_PROFILES || []).map(global.hocProfileToCard));
    }
    return db.collection('Doctors').where('status', '==', 'active').get().then(function (snap) {
      var list = [];
      var seen = {};
      snap.forEach(function (doc) {
        var card = global.hocFirestoreDoctorToCard(doc);
        if (!card) return;
        var key = String(card.doctorId || card.id);
        if (seen[key]) return;
        seen[key] = true;
        list.push(card);
      });
      var src = localFallback && localFallback.length ? localFallback : global.HOC_BOOKING_DOCTOR_PROFILES;
      (src || []).forEach(function (p) {
        var card = global.hocProfileToCard(p);
        var key = String(card.doctorId || card.id);
        if (seen[key]) return;
        seen[key] = true;
        list.push(card);
      });
      return list;
    }).catch(function (e) {
      console.warn('hocLoadBookingDoctors', e);
      var src = localFallback && localFallback.length ? localFallback : global.HOC_BOOKING_DOCTOR_PROFILES;
      return (src || []).map(global.hocProfileToCard);
    });
  };
})(typeof window !== 'undefined' ? window : this);
