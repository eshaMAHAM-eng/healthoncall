/**
 * HealthOnCall — shared bell notifications (all dashboards).
 * Bell = appointments / prescriptions / system only. Chat unread = chat icon badge only.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'hoc-notif-styles';
  var PANEL_ID = 'hoc-bell-panel';
  var _lastSoundAt = 0;
  var _knownNotifIds = {};

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.hoc-bell-wrap{position:relative;display:inline-flex}' +
      '.hoc-bell-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f43f5e;color:#fff;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center;line-height:18px;box-shadow:0 2px 8px rgba(244,63,94,.45);animation:hocBellPop .35s ease}' +
      '.hoc-bell-badge.show{display:inline-flex}' +
      '@keyframes hocBellPop{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}' +
      '#hoc-bell-panel{position:fixed;z-index:6000;width:min(360px,calc(100vw - 24px));max-height:min(420px,70vh);background:var(--card,#fff);border:1px solid var(--card-border,rgba(15,23,42,.08));border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.18);display:none;flex-direction:column;overflow:hidden}' +
      '#hoc-bell-panel.open{display:flex}' +
      '#hoc-bell-panel .hb-head{padding:14px 16px;border-bottom:1px solid var(--bd,#e2e8f0);display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '#hoc-bell-panel .hb-close{background:none;border:none;color:var(--mt,#94a3b8);cursor:pointer;font-size:16px;padding:4px 8px;line-height:1}' +
      '#hoc-bell-panel .hb-close:hover{color:var(--tx,#0f172a)}' +
      '#hoc-bell-panel .hb-head h4{margin:0;font-size:14px;font-weight:800;color:var(--tx,#0f172a)}' +
      '#hoc-bell-panel .hb-list{overflow-y:auto;flex:1;padding:8px}' +
      '#hoc-bell-panel .hb-item{padding:10px 12px;border-radius:12px;margin-bottom:4px;cursor:pointer;border:1px solid transparent}' +
      '#hoc-bell-panel .hb-item:hover{background:var(--inp,#f8fafc)}' +
      '#hoc-bell-panel .hb-item.unread{background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.12)}' +
      '#hoc-bell-panel .hb-title{font-size:12px;font-weight:700;color:var(--tx,#0f172a)}' +
      '#hoc-bell-panel .hb-body{font-size:11px;color:var(--mt,#94a3b8);margin-top:2px;line-height:1.4}' +
      '#hoc-bell-panel .hb-time{font-size:10px;color:var(--mt,#94a3b8);margin-top:4px}' +
      '#hoc-bell-panel .hb-empty{padding:28px 16px;text-align:center;color:var(--mt,#94a3b8);font-size:12px}' +
      '#hoc-bell-panel .hb-foot{padding:10px 12px;border-top:1px solid var(--bd,#e2e8f0);text-align:center}' +
      '#hoc-bell-panel .hb-mark{font-size:11px;font-weight:700;color:#059669;cursor:pointer;background:none;border:none}' +
      '.hoc-staff-bell-fab{position:fixed;top:18px;right:68px;z-index:850;width:44px;height:44px;border-radius:14px;border:1.5px solid var(--card-border,rgba(255,255,255,.12));background:var(--card,#0f172a);color:var(--tx,#e2e8f0);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 8px 24px rgba(0,0,0,.15)}';
    document.head.appendChild(st);
  }

  global.hocPlayNotifSound = function () {
    var now = Date.now();
    if (now - _lastSoundAt < 1200) return;
    _lastSoundAt = now;
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var notes = [880, 1100, 880, 1320];
      notes.forEach(function (freq, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.14);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.12);
        o.stop(ctx.currentTime + i * 0.12 + 0.16);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 800);
    } catch (e) {}
  };

  global.hocNotifyPush = function (db, opts) {
    if (!db || !opts) return Promise.resolve();
    var row = {
      targetRole: opts.targetRole || 'patient',
      targetUid: opts.targetUid || '',
      targetId: opts.targetId || '',
      type: opts.type || 'info',
      title: opts.title || 'Notification',
      body: opts.body || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      meta: opts.meta || {}
    };
    return db.collection('Notifications').add(row).catch(function (e) {
      console.warn('hocNotifyPush', e);
    });
  };

  global.hocResolveProfileUid = function (db, role, id) {
    if (!db || !id) return Promise.resolve(null);
    var col = role === 'doctor' ? 'Doctors' : role === 'lab' ? 'LabTechnicians' : 'Patients';
    var sid = String(id);
    return db.collection(col).doc(sid).get().then(function (snap) {
      if (snap.exists && snap.data().uid) return snap.data().uid;
      var field = role === 'doctor' ? 'doctorId' : role === 'lab' ? 'labTechId' : 'patientId';
      return db.collection(col).where(field, '==', sid).limit(1).get().then(function (q) {
        if (!q.empty && q.docs[0].data().uid) return q.docs[0].data().uid;
        return null;
      });
    }).catch(function () { return null; });
  };

  /** Attach doctorUid / patientUid before Appointments write (rules + doctor queue). */
  global.hocEnrichAppointmentForCloud = function (db, row) {
    if (!db || !row) return Promise.resolve(row);
    row = Object.assign({}, row);
    if (!row.status || row.status === 'Pending') row.status = 'requested';
    if (!row.patientUid && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      row.patientUid = firebase.auth().currentUser.uid;
    }
    var chain = Promise.resolve();
    if (row.doctorId && !row.doctorUid) {
      chain = global.hocResolveProfileUid(db, 'doctor', row.doctorId).then(function (uid) {
        if (uid) row.doctorUid = uid;
      });
    }
    if (row.patientId && !row.patientUid) {
      chain = chain.then(function () {
        return global.hocResolveProfileUid(db, 'patient', row.patientId).then(function (uid) {
          if (uid) row.patientUid = uid;
        });
      });
    }
    return chain.then(function () { return row; });
  };

  /** Bump unread counter on Chats doc + optional push notification */
  global.hocChatNotifyRecipient = function (db, roomId, meta, senderRole, text) {
    if (!db || !roomId) return Promise.resolve();
    var isLabRoom = String(roomId).indexOf('lab_') === 0;
    var bump = {};
    var recipientRole = '';
    if (isLabRoom) {
      if (senderRole === 'patient') {
        bump.unreadLab = firebase.firestore.FieldValue.increment(1);
        recipientRole = 'lab';
      } else if (senderRole === 'lab' || senderRole === 'labTech') {
        bump.unreadPatient = firebase.firestore.FieldValue.increment(1);
        recipientRole = 'patient';
      }
    } else if (senderRole === 'patient') {
      bump.unreadDoctor = firebase.firestore.FieldValue.increment(1);
      recipientRole = 'doctor';
    } else if (senderRole === 'doctor') {
      bump.unreadPatient = firebase.firestore.FieldValue.increment(1);
      recipientRole = 'patient';
    } else {
      return Promise.resolve();
    }
    bump.lastMessage = String(text || '').slice(0, 200);
    bump.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    var merge = Object.assign({}, meta || {}, bump);
    return db.collection('Chats').doc(roomId).set(merge, { merge: true }).catch(function (e) { console.warn('hocChatNotifyRecipient', e); });
  };

  global.hocClearChatUnread = function (db, roomId, roleKey) {
    if (!db || !roomId || !roleKey) return Promise.resolve();
    var patch = {};
    if (roleKey === 'patient') patch.unreadPatient = 0;
    else if (roleKey === 'doctor') patch.unreadDoctor = 0;
    else if (roleKey === 'lab') patch.unreadLab = 0;
    return db.collection('Chats').doc(roomId).set(patch, { merge: true }).catch(function () {});
  };

  function fmtTime(ts) {
    if (!ts) return '';
    var t = ts.seconds ? ts.seconds * 1000 : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
    if (!t || isNaN(t)) return '';
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    return Math.floor(m / 60) + 'h ago';
  }

  global.HOCNotifHub = {
    _state: null,

    init: function (opts) {
      injectStyles();
      var self = this;
      var st = {
        db: opts.db,
        role: opts.role || 'patient',
        uid: opts.uid || '',
        profileId: opts.profileId || '',
        items: [],
        chatUnread: 0,
        extraCount: 0,
        unsub: [],
        panelOpen: false,
        bells: []
      };
      this._state = st;

      var sels = opts.bellSelectors || ['.notif-btn', '.m-notif', '.mob-notif', '.topbar-notif-dot'];
      sels.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (btn) {
          self._wireBell(btn, st);
        });
      });

      if (opts.injectStaffFab && !document.getElementById('hocStaffBellFab')) {
        var fab = document.createElement('button');
        fab.id = 'hocStaffBellFab';
        fab.className = 'hoc-staff-bell-fab';
        fab.type = 'button';
        fab.title = 'Notifications';
        fab.innerHTML = '<i class="fas fa-bell"></i>';
        document.body.appendChild(fab);
        self._wireBell(fab, st);
      }

      self._ensurePanel();
      self._startListeners(st);
      document.addEventListener('click', function (e) {
        var p = document.getElementById(PANEL_ID);
        if (!p || !p.classList.contains('open')) return;
        if (p.contains(e.target)) return;
        var hit = false;
        st.bells.forEach(function (b) { if (b.contains(e.target)) hit = true; });
        if (!hit) self._closePanel();
      });
    },

    _wireBell: function (btn, st) {
      if (!btn || btn.getAttribute('data-hoc-bell')) return;
      btn.setAttribute('data-hoc-bell', '1');
      btn.setAttribute('type', btn.getAttribute('type') || 'button');
      btn.classList.add('hoc-bell-wrap');
      var badge = document.createElement('span');
      badge.className = 'hoc-bell-badge';
      badge.textContent = '0';
      btn.appendChild(badge);
      st.bells.push(btn);
      var self = this;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self._togglePanel(btn);
      });
    },

    _ensurePanel: function () {
      if (document.getElementById(PANEL_ID)) return;
      var p = document.createElement('div');
      p.id = PANEL_ID;
      p.innerHTML =
        '<div class="hb-head"><h4><i class="fas fa-bell" style="color:#10b981;margin-right:6px"></i>Notifications</h4><div style="display:flex;align-items:center;gap:8px"><button type="button" class="hb-mark" id="hocBellMarkAll">Mark all read</button><button type="button" class="hb-close" id="hocBellClose" aria-label="Close"><i class="fas fa-times"></i></button></div></div>' +
        '<div class="hb-list" id="hocBellList"><div class="hb-empty">No notifications yet</div></div>';
      document.body.appendChild(p);
      var self = this;
      document.getElementById('hocBellMarkAll').onclick = function () { self.markAllRead(); };
      document.getElementById('hocBellClose').onclick = function () { self._closePanel(); };
      if (!global._hocBellEscBound) {
        global._hocBellEscBound = true;
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') self._closePanel();
        });
      }
    },

    _togglePanel: function (anchorBtn) {
      var p = document.getElementById(PANEL_ID);
      if (!p) return;
      if (p.classList.contains('open')) { this._closePanel(); return; }
      var rect = (anchorBtn || (this._state && this._state.bells[0]) || document.body).getBoundingClientRect();
      p.style.top = (rect.bottom + 8) + 'px';
      p.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
      p.classList.add('open');
      this._state.panelOpen = true;
      this._renderList();
    },

    _closePanel: function () {
      var p = document.getElementById(PANEL_ID);
      if (p) p.classList.remove('open');
      if (this._state) this._state.panelOpen = false;
    },

    _updateBadge: function () {
      var st = this._state;
      if (!st) return;
      var unreadNotifs = st.items.filter(function (x) { return !x.read && x.type !== 'chat'; }).length;
      var total = unreadNotifs + (st.extraCount || 0);
      st.bells.forEach(function (btn) {
        var b = btn.querySelector('.hoc-bell-badge');
        if (!b) return;
        b.textContent = total > 99 ? '99+' : String(total);
        b.classList.toggle('show', total > 0);
      });
      var chatN = st.chatUnread || 0;
      document.querySelectorAll('#hocChatFabBadge, #docChatFabBadge, #chatFabBadge, #topbarChatBadge, .hoc-chat-fab-badge').forEach(function (el) {
        el.textContent = chatN > 99 ? '99+' : String(chatN);
        el.classList.toggle('show', chatN > 0);
      });
      var dots = document.querySelectorAll('#notifDot, #mobileNotifDot, .mob-dot, .notif-btn .dot');
      dots.forEach(function (d) {
        d.classList.toggle('active', total > 0);
      });
    },

    _renderList: function () {
      var list = document.getElementById('hocBellList');
      if (!list || !this._state) return;
      var st = this._state;
      var displayItems = st.items.filter(function (x) { return x.type !== 'chat'; });
      if (!displayItems.length) {
        list.innerHTML = '<div class="hb-empty"><i class="fas fa-bell-slash" style="display:block;font-size:24px;margin-bottom:8px;opacity:.35"></i>No new notifications</div>';
        return;
      }
      var html = '';
      displayItems.slice(0, 40).forEach(function (it) {
        html += '<div class="hb-item' + (it.read ? '' : ' unread') + '" data-nid="' + esc(it.id) + '">' +
          '<div class="hb-title">' + esc(it.title) + '</div>' +
          '<div class="hb-body">' + esc(it.body) + '</div>' +
          '<div class="hb-time">' + fmtTime(it.createdAt) + '</div></div>';
      });
      list.innerHTML = html;
      var self = this;
      list.querySelectorAll('.hb-item[data-nid]').forEach(function (el) {
        el.onclick = function () {
          var id = el.getAttribute('data-nid');
          var it = st.items.filter(function (x) { return x.id === id; })[0];
          if (it && it.type === 'registration' && typeof global.navTo === 'function') {
            if (/lab/i.test(it.body || it.title || '')) global.navTo('lab');
            else global.navTo('doctors');
          }
          if (id) self._markOneRead(id);
        };
      });
    },

    _markOneRead: function (id) {
      var st = this._state;
      if (!st || !st.db) return;
      st.items.forEach(function (it) { if (it.id === id) it.read = true; });
      this._updateBadge();
      this._renderList();
      st.db.collection('Notifications').doc(id).update({ read: true }).catch(function () {});
    },

    markAllRead: function () {
      var st = this._state;
      if (!st || !st.db) return;
      var batch = [];
      st.items.forEach(function (it) {
        if (!it.read && it.type !== 'chat') {
          it.read = true;
          batch.push(st.db.collection('Notifications').doc(it.id).update({ read: true }));
        }
      });
      this._updateBadge();
      this._renderList();
      Promise.all(batch).catch(function (e) { console.warn('markAllRead', e); });
    },

    closePanel: function () { this._closePanel(); },

    markNotifRead: function () { this.markAllRead(); },

    setExtraCount: function (n) {
      if (!this._state) return;
      this._state.extraCount = n || 0;
      this._updateBadge();
    },

    _onNewItems: function (isFirst) {
      var st = this._state;
      if (!st) return;
      if (!isFirst) global.hocPlayNotifSound();
      this._updateBadge();
      if (st.panelOpen) this._renderList();
    },

    _startListeners: function (st) {
      var self = this;
      if (!st.db) return;

      var q;
      if (st.role === 'staff') {
        q = st.db.collection('Notifications').where('targetRole', '==', 'staff').limit(80);
      } else if (st.role === 'lab' && st.uid) {
        q = st.db.collection('Notifications').where('targetUid', '==', st.uid).limit(80);
      } else if (st.role === 'lab') {
        q = st.db.collection('Notifications').where('targetRole', '==', 'lab').limit(80);
      } else if (st.uid) {
        q = st.db.collection('Notifications').where('targetUid', '==', st.uid).limit(80);
      }
      if (q) {
        var firstLoad = true;
        var unsubN = q.onSnapshot(function (snap) {
          var hadNew = false;
          snap.forEach(function (doc) {
            if (!_knownNotifIds[doc.id] && !firstLoad) hadNew = true;
            _knownNotifIds[doc.id] = true;
          });
          st.items = [];
          snap.forEach(function (doc) {
            var d = doc.data();
            if (d.type === 'chat') return;
            if (st.role === 'lab' && st.uid) {
              var tu = String(d.targetUid || '');
              if (tu && tu !== st.uid && tu !== '_broadcast') return;
            }
            st.items.push({ id: doc.id, read: !!d.read, title: d.title, body: d.body, type: d.type, createdAt: d.createdAt });
          });
          st.items.sort(function (a, b) {
            var ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
            var tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
            return tb - ta;
          });
          if (firstLoad) _knownNotifIds[st.role + (st.uid || '')] = true;
          else if (hadNew) global.hocPlayNotifSound();
          self._updateBadge();
          if (st.panelOpen) self._renderList();
          firstLoad = false;
        }, function (e) { console.warn('Notifications listener', e); });
        st.unsub.push(unsubN);
      }

      if (st.role === 'doctor' && st.profileId) {
        var unsubDocId = st.db.collection('Notifications')
          .where('targetRole', '==', 'doctor')
          .where('targetId', '==', st.profileId)
          .limit(40)
          .onSnapshot(function (snap) {
            var map = {};
            st.items.forEach(function (it) { map[it.id] = it; });
            snap.forEach(function (doc) {
              var d = doc.data();
              if (d.type === 'chat') return;
              var isNew = !_knownNotifIds[doc.id];
              map[doc.id] = { id: doc.id, read: !!d.read, title: d.title, body: d.body, type: d.type, createdAt: d.createdAt };
              if (isNew && _knownNotifIds[st.role + (st.uid || '')]) global.hocPlayNotifSound();
              _knownNotifIds[doc.id] = true;
            });
            st.items = Object.keys(map).map(function (k) { return map[k]; });
            st.items.sort(function (a, b) {
              var ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
              var tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
              return tb - ta;
            });
            self._updateBadge();
            if (st.panelOpen) self._renderList();
          }, function () {});
        st.unsub.push(unsubDocId);
      }

      function hocChatRoomMatchesPatient(id, d, profileId) {
        if (id.indexOf('lab_') === 0) {
          var labKey = id.slice(4);
          return typeof global.hocPatientIdsMatch === 'function'
            ? global.hocPatientIdsMatch(labKey, profileId)
            : id === 'lab_' + profileId;
        }
        if (d.patientId && profileId) {
          return typeof global.hocPatientIdsMatch === 'function'
            ? global.hocPatientIdsMatch(d.patientId, profileId)
            : d.patientId === profileId;
        }
        return true;
      }

      function hocChatRoomMatchesDoctor(id, d, profileId) {
        if (id.indexOf('lab_') === 0) return false;
        if (!d.doctorId || !profileId) return true;
        var dd = String(d.doctorId).replace(/^doc_/, '');
        var sd = String(profileId).replace(/^doc_/, '');
        return dd === sd || d.doctorId === profileId;
      }

      var unsubC = st.db.collection('Chats').onSnapshot(function (snap) {
        var chatSum = 0;
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var id = doc.id;
          if (st.role === 'patient') {
            if (!hocChatRoomMatchesPatient(id, d, st.profileId)) return;
            chatSum += d.unreadPatient || 0;
          } else if (st.role === 'doctor') {
            if (!hocChatRoomMatchesDoctor(id, d, st.profileId)) return;
            chatSum += d.unreadDoctor || 0;
          } else if (st.role === 'lab') {
            if (id.indexOf('lab_') !== 0) return;
            chatSum += d.unreadLab || 0;
          }
        });
        var prev = st.chatUnread;
        st.chatUnread = chatSum;
        if (chatSum > prev && prev >= 0) global.hocPlayNotifSound();
        self._updateBadge();
        if (st.panelOpen) self._renderList();
      }, function () {});
      st.unsub.push(unsubC);

      if (st.role === 'patient' && st.profileId) {
        var prevAppt = {};
        var unsubA = st.db.collection('Appointments').where('patientId', '==', st.profileId).onSnapshot(function (snap) {
          snap.forEach(function (doc) {
            var d = doc.data();
            var id = doc.id;
            var prev = prevAppt[id];
            if (prev) {
              if (prev.status !== 'staff-approved' && d.status === 'staff-approved') {
                global.hocPlayNotifSound();
                global.hocNotifyPush(st.db, {
                  targetRole: 'patient', targetUid: st.uid, targetId: st.profileId,
                  type: 'appointment', title: 'Staff confirmed', body: (typeof global.hocIsLabAppointment === 'function' && global.hocIsLabAppointment(d)) ? 'Staff approved your lab test booking. Our lab team will contact you.' : ('Your appointment with ' + (d.doctorName || 'doctor') + ' was approved.')
                });
              }
              if (!prev.hadRx && d.prescription) {
                global.hocPlayNotifSound();
                global.hocNotifyPush(st.db, {
                  targetRole: 'patient', targetUid: st.uid, targetId: st.profileId,
                  type: 'prescription', title: 'New prescription', body: 'Dr. ' + (d.doctorName || '') + ' sent your prescription.'
                });
              }
            }
            prevAppt[id] = { status: d.status || '', hadRx: !!d.prescription };
          });
        });
        st.unsub.push(unsubA);
      }

      if (st.role === 'doctor' && st.profileId) {
        var prevDocAppt = {};
        var unsubD = st.db.collection('Appointments').onSnapshot(function (snap) {
          snap.forEach(function (doc) {
            var d = doc.data();
            if (typeof global.hocIsLabAppointment === 'function' && global.hocIsLabAppointment(d)) return;
            if (d.doctorId !== st.profileId && String(d.doctorId || '').replace(/^doc_/, '') !== String(st.profileId).replace(/^doc_/, '')) return;
            var id = doc.id;
            var prev = prevDocAppt[id];
            if (prev && prev.status !== 'staff-approved' && d.status === 'staff-approved') {
              global.hocPlayNotifSound();
              global.hocNotifyPush(st.db, {
                targetRole: 'doctor', targetUid: st.uid, targetId: st.profileId,
                type: 'appointment', title: 'New appointment', body: (d.patientName || 'Patient') + ' — staff approved, ready for you.'
              });
            }
            prevDocAppt[id] = { status: d.status || '' };
          });
        });
        st.unsub.push(unsubD);
      }

      if (st.role === 'lab') {
        var prevLabAppt = {};
        var unsubLabA = st.db.collection('Appointments').onSnapshot(function (snap) {
          snap.forEach(function (doc) {
            var d = doc.data();
            if (typeof global.hocIsLabAppointment === 'function' && !global.hocIsLabAppointment(d)) return;
            if (st.uid) {
              var mine = d.assignedLabTechUid === st.uid;
              var myIds = [st.profileId].filter(Boolean);
              if (d.assignedLabTechId && myIds.indexOf(d.assignedLabTechId) >= 0) mine = true;
              if (d.assignedLabTechUid || d.assignedLabTechId) { if (!mine) return; }
            }
            var id = doc.id;
            var prev = prevLabAppt[id];
            if (prev && prev.status !== 'staff-approved' && d.status === 'staff-approved') {
              global.hocPlayNotifSound();
              global.hocNotifyPush(st.db, {
                targetRole: 'lab', targetUid: st.uid, targetId: st.profileId || '',
                type: 'appointment', title: 'New lab booking',
                body: (d.patientName || 'Patient') + ' — ' + (d.symptoms || 'Lab test') + ' (' + (d.visitType === 'clinic' ? 'clinic' : 'home') + ')'
              });
            }
            prevLabAppt[id] = { status: d.status || '' };
          });
        });
        st.unsub.push(unsubLabA);
      }

      if (st.role === 'staff') {
        var pendingAppt = 0;
        var pendingVerify = 0;
        function syncStaffExtra() {
          self.setExtraCount(pendingAppt + pendingVerify);
        }
        var unsubA = st.db.collection('Appointments').onSnapshot(function (snap) {
          var pn = 0;
          snap.forEach(function (doc) {
            var s = (doc.data().status || '');
            if (s === 'requested' || s === 'Pending' || s === 'pending') pn++;
          });
          pendingAppt = pn;
          syncStaffExtra();
        });
        st.unsub.push(unsubA);
        var unsubP = st.db.collection('Doctors').where('status', '==', 'pending').onSnapshot(function (s) {
          var dv = s.size;
          st.db.collection('LabTechnicians').where('status', '==', 'pending').get().then(function (l) {
            pendingVerify = dv + l.size;
            syncStaffExtra();
          });
        });
        st.unsub.push(unsubP);
      }
    },

    destroy: function () {
      var st = this._state;
      if (!st) return;
      st.unsub.forEach(function (u) { try { u(); } catch (e) {} });
      this._state = null;
    }
  };
})(typeof window !== 'undefined' ? window : this);
