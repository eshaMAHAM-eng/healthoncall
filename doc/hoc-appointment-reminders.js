/**
 * HealthOnCall — in-app appointment reminders (24h + 1h before).
 */
(function (global) {
  'use strict';

  var ACTIVE = ['staff-approved', 'confirmed', 'in-progress', 'Pending', 'requested'];

  function parseAptDate(apt) {
    if (!apt || !apt.date) return null;
    var tm = String(apt.time || '09:00').trim();
    var d = new Date(apt.date + 'T' + tm);
    if (isNaN(d.getTime())) d = new Date(apt.date + ' ' + tm);
    if (isNaN(d.getTime())) d = new Date(apt.date);
    return isNaN(d.getTime()) ? null : d;
  }

  function hoursUntil(apt) {
    var d = parseAptDate(apt);
    if (!d) return null;
    return (d.getTime() - Date.now()) / 3600000;
  }

  global.HOCAppointmentReminders = {
    runForPatient: function (db, patientId, uid) {
      if (!db || !patientId || typeof hocNotifyPush !== 'function') return Promise.resolve();
      return db.collection('Appointments').where('patientId', '==', patientId).get().then(function (snap) {
        var jobs = [];
        snap.forEach(function (doc) {
          var apt = doc.data();
          apt.id = doc.id;
          if (ACTIVE.indexOf(apt.status) < 0) return;
          var h = hoursUntil(apt);
          if (h === null || h < 0) return;
          var updates = {};
          if (h <= 24 && h > 1 && !apt.reminderSent24h) {
            jobs.push(hocNotifyPush(db, {
              targetRole: 'patient', targetUid: uid || '', targetId: patientId,
              type: 'appointment', title: 'Appointment in 24 hours',
              body: 'Reminder: ' + (apt.doctorName || 'your doctor') + ' on ' + apt.date + ' at ' + (apt.time || '')
            }));
            updates.reminderSent24h = true;
          }
          if (h <= 1 && h >= 0 && !apt.reminderSent1h) {
            jobs.push(hocNotifyPush(db, {
              targetRole: 'patient', targetUid: uid || '', targetId: patientId,
              type: 'appointment', title: 'Appointment in 1 hour',
              body: 'Your visit with ' + (apt.doctorName || 'doctor') + ' starts soon (' + (apt.time || '') + ').'
            }));
            updates.reminderSent1h = true;
          }
          if (Object.keys(updates).length) {
            jobs.push(db.collection('Appointments').doc(doc.id).set(updates, { merge: true }));
          }
        });
        return Promise.all(jobs);
      }).catch(function () {});
    },

    runForDoctor: function (db, doctorId, uid) {
      if (!db || !doctorId || typeof hocNotifyPush !== 'function') return Promise.resolve();
      return db.collection('Appointments').get().then(function (snap) {
        var jobs = [];
        snap.forEach(function (doc) {
          var apt = doc.data();
          apt.id = doc.id;
          if (typeof hocApptBelongsToDoctor === 'function' && !hocApptBelongsToDoctor(apt, doctorId)) return;
          if (ACTIVE.indexOf(apt.status) < 0) return;
          var h = hoursUntil(apt);
          if (h === null || h < 0) return;
          var updates = {};
          if (h <= 1 && h >= 0 && !apt.doctorReminderSent1h) {
            jobs.push(hocNotifyPush(db, {
              targetRole: 'doctor', targetUid: uid || '', targetId: doctorId,
              type: 'appointment', title: 'Upcoming consultation',
              body: 'Patient ' + (apt.patientName || '') + ' at ' + (apt.time || '') + ' today.'
            }));
            updates.doctorReminderSent1h = true;
          }
          if (Object.keys(updates).length) {
            jobs.push(db.collection('Appointments').doc(doc.id).set(updates, { merge: true }));
          }
        });
        return Promise.all(jobs);
      }).catch(function () {});
    }
  };
})(window);
