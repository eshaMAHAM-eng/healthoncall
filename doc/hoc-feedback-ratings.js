/**
 * HealthOnCall — aggregate doctor ratings from Firestore Feedback.
 */
(function (global) {
  'use strict';

  global.HOCFeedbackRatings = {
    loadMap: function (db) {
      if (!db) return Promise.resolve({});
      return db.collection('Feedback').where('staffVisible', '==', true).get().then(function (snap) {
        var map = {};
        snap.forEach(function (doc) {
          var d = doc.data();
          var r = parseInt(d.rating, 10) || 0;
          if (!r) return;
          var keys = [];
          if (d.doctorId) keys.push(String(d.doctorId));
          if (d.doctor) keys.push(String(d.doctor).toLowerCase().trim());
          keys.forEach(function (k) {
            if (!k) return;
            if (!map[k]) map[k] = { sum: 0, count: 0 };
            map[k].sum += r;
            map[k].count += 1;
          });
        });
        Object.keys(map).forEach(function (k) {
          map[k].avg = (map[k].sum / map[k].count).toFixed(1);
        });
        return map;
      }).catch(function () { return {}; });
    },

    ratingForDoctor: function (map, doctor) {
      if (!map || !doctor) return '4.5';
      var id = doctor.id || doctor.doctorId || '';
      var name = String(doctor.name || '').toLowerCase().trim();
      if (id && map[id]) return map[id].avg;
      if (name && map[name]) return map[name].avg;
      return doctor.rating || '4.5';
    }
  };
})(window);
