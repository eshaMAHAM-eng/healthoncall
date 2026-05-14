/** HealthOnCall — render Firestore chat snapshots (lab-style UI). */
(function (global) {
  'use strict';

  function fmtTime(ts) {
    if (!ts) return '';
    try {
      var d = ts.seconds ? new Date(ts.seconds * 1000) : (ts.toDate ? ts.toDate() : new Date(ts));
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function fmtDay(ts) {
    if (!ts) return '';
    try {
      var d = ts.seconds ? new Date(ts.seconds * 1000) : (ts.toDate ? ts.toDate() : new Date(ts));
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  global.hocChatRenderSnapshot = function (container, snapshot, opts) {
    if (!container) return;
    opts = opts || {};
    var isMe = opts.isMe || function () { return false; };
    var labelFor = opts.labelFor || function (msg) {
      if (msg.role === 'doctor') return 'Doctor';
      if (msg.role === 'patient') return 'Patient';
      if (msg.role === 'lab' || msg.role === 'labTech') return 'Lab';
      if (msg.role === 'system') return 'System';
      return msg.senderName || 'User';
    };
    var lastDay = '';
    var html = '';
    if (!snapshot || snapshot.empty) {
      container.innerHTML = '<div class="hoc-chat-empty"><i class="fas fa-comments"></i><p>No messages yet. Say hello!</p></div>';
      return;
    }
    snapshot.forEach(function (doc) {
      var msg = doc.data();
      var day = fmtDay(msg.timestamp);
      if (day && day !== lastDay) {
        html += '<div class="hoc-chat-day">' + esc(day) + '</div>';
        lastDay = day;
      }
      if (msg.role === 'system') {
        html += '<div class="hoc-chat-row system"><div class="hoc-chat-bubble">' + esc(msg.text) + '</div></div>';
        return;
      }
      var me = !!isMe(msg);
      var rowCls = me ? 'me' : 'them';
      html += '<div class="hoc-chat-row ' + rowCls + '">';
      if (!me) html += '<div class="hoc-chat-meta"><span class="dot"></span>' + esc(labelFor(msg)) + '</div>';
      html += '<div class="hoc-chat-bubble">' + esc(msg.text) + '<div class="hoc-chat-time">' + esc(fmtTime(msg.timestamp)) + '</div></div></div>';
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  };
})(window);
