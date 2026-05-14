/**
 * HealthOnCall — unified sidebar toggle (all portals).
 * Defines global hocToggleSidebar / hocCloseSidebar; each page binds its own hamburger.
 */
(function () {
  'use strict';
  if (window._hocSidebarJsLoaded) return;
  window._hocSidebarJsLoaded = true;

  function $(id) { return document.getElementById(id); }

  window.hocToggleSidebar = function () {
    var sb = $('hocSidebar');
    var ov = $('hocSbOverlay');
    if (!sb) return;
    sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active');
    document.body.style.overflow = sb.classList.contains('open') ? 'hidden' : '';
  };

  window.hocCloseSidebar = function () {
    var sb = $('hocSidebar');
    var ov = $('hocSbOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.hocClose = window.hocCloseSidebar;
})();
