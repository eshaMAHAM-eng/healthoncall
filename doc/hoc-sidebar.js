/**
 * HealthOnCall — unified sidebar toggle (Patient · Doctor · Staff · Lab · all sub-pages).
 */
(function () {
  'use strict';
  if (window._hocSidebarJsLoaded) return;
  window._hocSidebarJsLoaded = true;

  var MOBILE_BP = 1024;

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

  function bindClick(el, fn) {
    if (!el || el._hocSidebarBound) return;
    el._hocSidebarBound = true;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  function bindSidebarControls() {
    ['hocHamburger', 'mobHamburgerBtn', 'mobHamburger'].forEach(function (id) {
      bindClick($(id), window.hocToggleSidebar);
    });

    document.querySelectorAll('.topbar-hamburger, [data-hoc-sidebar-toggle]').forEach(function (el) {
      bindClick(el, window.hocToggleSidebar);
    });

    bindClick($('hocSbOverlay'), window.hocCloseSidebar);

    var sb = $('hocSidebar');
    if (sb && !sb._hocNavBound) {
      sb._hocNavBound = true;
      sb.addEventListener('click', function (e) {
        if (window.innerWidth > MOBILE_BP) return;
        var link = e.target.closest('a[href], button.sb-link, .sb-link');
        if (link) window.hocCloseSidebar();
      });
    }
  }

  function initSidebar() {
    bindSidebarControls();
    if (window._hocSidebarKeysBound) return;
    window._hocSidebarKeysBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.hocCloseSidebar();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > MOBILE_BP) window.hocCloseSidebar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();
