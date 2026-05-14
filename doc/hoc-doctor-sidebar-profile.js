/** Sync doctor sidebar footer + page headers from hoc_user / Firebase profile */
(function (global) {
  'use strict';

  function hocDoctorProfileFromStorage() {
    try { return JSON.parse(global.localStorage.getItem('hoc_user') || '{}'); } catch (e) { return {}; }
  }

  function hocDoctorDisplayName(profile) {
    profile = profile || hocDoctorProfileFromStorage();
    return profile.name || 'Doctor';
  }

  function hocDoctorServiceLabel(profile) {
    profile = profile || hocDoctorProfileFromStorage();
    var s = profile.service || profile.specialization || profile.department || profile.role || 'Doctor portal';
    if (typeof global.hocMapToService === 'function') {
      var mapped = global.hocMapToService(s);
      if (mapped) return mapped;
    }
    return s;
  }

  function hocDoctorInitials(name) {
    name = String(name || 'DR');
    return name.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2) || 'DR';
  }

  global.hocApplyDoctorSidebarProfile = function (profile) {
    profile = profile || hocDoctorProfileFromStorage();
    var name = hocDoctorDisplayName(profile);
    var role = hocDoctorServiceLabel(profile);
    var initials = hocDoctorInitials(name);

    if (typeof global.hocApplyRegisteredNameUI === 'function') {
      global.hocApplyRegisteredNameUI({
        name: name,
        welcomeFirst: global.hocUserFirstName ? global.hocUserFirstName(name) : name.replace(/^Dr\.\s*/i, '').split(/\s+/)[0],
        avatarBg: '6366f1'
      });
    }

    ['sidebarRole', 'sidebarRoleLine', 'sb-urole'].forEach(function (id) {
      document.querySelectorAll('#' + id + ', .' + id).forEach(function (el) { el.textContent = role; });
    });
    document.querySelectorAll('.sb-urole').forEach(function (el) { el.textContent = role; });

    document.querySelectorAll('.sb-avatar').forEach(function (el) {
      if (el.querySelector('img')) return;
      el.textContent = initials;
    });

    var ctx = document.getElementById('hocDoctorScopeLine');
    if (ctx) ctx.textContent = 'Showing only your patients — ' + name + ' · ' + role;
  };

  global.hocDoctorDisplayName = hocDoctorDisplayName;
  global.hocDoctorServiceLabel = hocDoctorServiceLabel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { global.hocApplyDoctorSidebarProfile(); });
  } else {
    global.hocApplyDoctorSidebarProfile();
  }
})(window);
