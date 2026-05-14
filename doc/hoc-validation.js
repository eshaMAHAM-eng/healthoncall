/** HealthOnCall — shared form validation (client-side) */
(function (global) {
  'use strict';

  var GARBAGE = /^(abc|test|asdf|qwerty|xyz|aaa|bbb|123|na|n\/a|none|ok|hi|hello)$/i;

  function fail(msg) { return { ok: false, msg: msg }; }
  function pass() { return { ok: true }; }

  global.hocRejectGarbageText = function (text, minLen, label) {
    var t = String(text || '').trim();
    label = label || 'This field';
    if (!t) return fail(label + ' is required.');
    if (t.length < (minLen || 2)) return fail(label + ' is too short.');
    if (GARBAGE.test(t)) return fail('Please enter a real ' + label.toLowerCase() + ', not placeholder text.');
    var compact = t.replace(/\s/g, '');
    if (/^(.)\1{4,}$/.test(compact)) return fail('Please do not enter random repeated characters.');
    return pass();
  };

  global.hocValidatePersonName = function (text, label) {
    var t = String(text || '').trim();
    label = label || 'Name';
    var base = global.hocRejectGarbageText(t, 2, label);
    if (!base.ok) return base;
    if (!/^[A-Za-z][A-Za-z\s.'-]{1,48}$/.test(t)) {
      return fail(label + ' should contain letters only (e.g. Sara Khan).');
    }
    if (t.split(/\s+/).filter(Boolean).length < 1) return fail('Enter at least first name.');
    return pass();
  };

  global.hocValidatePkPhone = function (raw) {
    var ph = String(raw || '').replace(/[\s-]/g, '');
    if (ph.length !== 11 || !/^03\d{9}$/.test(ph)) {
      return fail('Enter a valid 11-digit mobile (03XXXXXXXXX).');
    }
    return pass();
  };

  global.hocValidateEmail = function (email) {
    var e = String(email || '').trim();
    if (!e) return fail('Email is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return fail('Enter a valid email address.');
    return pass();
  };

  global.hocValidateBp = function (bp) {
    var t = String(bp || '').trim();
    if (!t) return pass();
    if (!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(t)) {
      return fail('Blood pressure should be like 120/80.');
    }
    var parts = t.split('/').map(function (x) { return parseInt(x.trim(), 10); });
    if (parts[0] < 70 || parts[0] > 220 || parts[1] < 40 || parts[1] > 140) {
      return fail('Blood pressure values look unrealistic.');
    }
    return pass();
  };

  global.hocValidateNumericOptional = function (val, min, max, label, unit) {
    var t = String(val || '').trim();
    if (!t) return pass();
    var n = parseFloat(t);
    if (isNaN(n)) return fail((label || 'Value') + ' must be a number' + (unit ? ' (' + unit + ')' : '') + '.');
    if (n < min || n > max) return fail((label || 'Value') + ' should be between ' + min + ' and ' + max + (unit ? ' ' + unit : '') + '.');
    return pass();
  };

  global.hocValidateSymptomReason = function (text) {
    var t = String(text || '').trim();
    if (!t) return fail('Please enter chief complaint / symptoms.');
    if (t.length < 8) return fail('Describe symptoms properly (at least 8 characters).');
    if (t.length > 500) return fail('Please shorten (max 500 characters).');
    if (GARBAGE.test(t)) return fail('Please describe real symptoms, not placeholder text.');
    var compact = t.replace(/\s/g, '');
    if (/^(.)\1{5,}$/.test(compact)) return fail('Please do not enter random characters.');
    var digits = (t.match(/\d/g) || []).length;
    if (digits > t.length * 0.45) return fail('Symptoms should describe a health problem, not mostly numbers.');
  if (!/[a-zA-Z]{3,}/.test(t)) return fail('Symptoms should include meaningful words.');
    return pass();
  };

  global.hocValidateLabTestOrder = function (raw) {
    var t = String(raw || '').trim();
    if (!t) return pass();
    var parts = t.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) return fail('Enter valid lab test names separated by commas.');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length < 2) return fail('Each lab test name must be at least 2 characters.');
      if (GARBAGE.test(p)) return fail('Lab test "' + p + '" is not valid.');
      if (!/[A-Za-z]{2,}/.test(p)) return fail('Lab test names should contain letters.');
    }
    return pass();
  };

  global.hocValidateDiagnosis = function (text) {
    var t = String(text || '').trim();
    if (!t) return pass();
    if (t.length < 3) return fail('Diagnosis is too short.');
    if (GARBAGE.test(t)) return fail('Enter a real diagnosis.');
    return pass();
  };

  global.hocValidateMedicineName = function (text) {
    var t = String(text || '').trim();
    if (!t) return pass();
    if (t.length < 2) return fail('Medicine name is too short.');
    if (GARBAGE.test(t)) return fail('Enter a real medicine name.');
    if (!/[A-Za-z]{2,}/.test(t)) return fail('Medicine name should contain letters.');
    return pass();
  };

  global.hocValidateFutureDate = function (dateStr) {
    if (!dateStr) return fail('Please select a date.');
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return fail('Invalid date.');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return fail('Appointment date cannot be in the past.');
    return pass();
  };

  global.hocValidateConsultationStep = function () {
    var checks = [
      global.hocValidateBp(document.getElementById('inp-bp') && document.getElementById('inp-bp').value),
      global.hocValidateNumericOptional(document.getElementById('inp-sugar') && document.getElementById('inp-sugar').value, 40, 600, 'Blood sugar', 'mg/dL'),
      global.hocValidateNumericOptional(document.getElementById('inp-temp') && document.getElementById('inp-temp').value, 95, 106, 'Temperature', '°F'),
      global.hocValidateNumericOptional(document.getElementById('inp-pulse') && document.getElementById('inp-pulse').value, 40, 200, 'Pulse', 'bpm'),
      global.hocValidateNumericOptional(document.getElementById('inp-weight') && document.getElementById('inp-weight').value, 2, 300, 'Weight', 'kg'),
      global.hocValidateNumericOptional(document.getElementById('inp-height') && document.getElementById('inp-height').value, 30, 250, 'Height', 'cm'),
      global.hocValidateNumericOptional(document.getElementById('inp-spo2') && document.getElementById('inp-spo2').value, 70, 100, 'SpO2', '%'),
      global.hocValidateNumericOptional(document.getElementById('inp-resp') && document.getElementById('inp-resp').value, 8, 40, 'Respiratory rate', '/min'),
      global.hocValidateSymptomReason(document.getElementById('inp-reason') && document.getElementById('inp-reason').value),
      global.hocValidateDiagnosis(document.getElementById('inp-diagnosis') && document.getElementById('inp-diagnosis').value),
      global.hocValidateLabTestOrder(document.getElementById('inp-lab') && document.getElementById('inp-lab').value)
    ];
    for (var i = 0; i < checks.length; i++) {
      if (!checks[i].ok) return checks[i];
    }
    var meds = document.querySelectorAll('.rx-row input');
    for (var j = 0; j < meds.length; j += 3) {
      var nm = meds[j] && meds[j].value;
      if (nm && String(nm).trim()) {
        var mv = global.hocValidateMedicineName(nm);
        if (!mv.ok) return mv;
      }
    }
    return pass();
  };
})(typeof window !== 'undefined' ? window : this);
