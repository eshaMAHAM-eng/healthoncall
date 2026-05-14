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

  function bindSidebarControls() {
    var hamburger = $('hocHamburger');
    var overlay = $('hocSbOverlay');
    if (hamburger && !hamburger._hocBound) {
      hamburger._hocBound = true;
      hamburger.addEventListener('click', window.hocToggleSidebar);
    }
    if (overlay && !overlay._hocBound) {
      overlay._hocBound = true;
      overlay.addEventListener('click', window.hocCloseSidebar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindSidebarControls();
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') window.hocCloseSidebar();
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 768) window.hocCloseSidebar();
      });
    });
  } else {
    bindSidebarControls();
  }
})();
