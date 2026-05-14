/**
 * HealthOnCall — WebRTC video calls with Firestore signaling (patient ↔ doctor).
 * Requires HTTPS or localhost and camera/mic permission.
 */
(function (global) {
  'use strict';

  var ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  var S = {
    pc: null,
    localStream: null,
    db: null,
    roomId: null,
    callId: null,
    role: null,
    prefix: '',
    unsubDoc: null,
    unsubCand: null
  };

  function $(prefix, base) {
    var p = prefix || '';
    if (p && p.charAt(p.length - 1) !== p.charAt(p.length - 1).toUpperCase()) {
      /* prefix like 'doc' -> docVideoCallOverlay */
    }
    var map = {
      overlay: p ? p + 'VideoCallOverlay' : 'videoCallOverlay',
      local: p ? p + 'LocalVideoElement' : 'localVideoElement',
      remote: p ? p + 'RemoteVideoElement' : 'remoteVideoElement',
      localPh: p ? p + 'LocalVideoPlaceholder' : 'localVideoPlaceholder',
      remoteName: p ? p + 'VideoRemoteName' : 'videoRemoteName',
      remoteAvatar: p ? p + 'VideoRemoteAvatar' : 'videoRemoteAvatar',
      status: p ? p + 'VideoCallStatus' : 'videoCallStatus'
    };
    return document.getElementById(map[base] || base);
  }

  function setStatus(prefix, text) {
    var el = $(prefix, 'status');
    if (el) el.textContent = text || '';
  }

  function showOverlay(prefix, on) {
    var ov = $(prefix, 'overlay');
    if (ov) ov.classList.toggle('active', !!on);
  }

  function attachLocal(prefix, stream) {
    var v = $(prefix, 'local');
    var ph = $(prefix, 'localPh');
    if (v) {
      v.srcObject = stream;
      v.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';
  }

  function attachRemote(prefix, stream) {
    var v = $(prefix, 'remote');
    var av = $(prefix, 'remoteAvatar');
    if (v) {
      v.srcObject = stream;
      v.style.display = 'block';
    }
    if (av) av.style.display = 'none';
  }

  function detachStreams(prefix) {
    var lv = $(prefix, 'local');
    var rv = $(prefix, 'remote');
    if (lv) { lv.srcObject = null; lv.style.display = ''; }
    if (rv) { rv.srcObject = null; rv.style.display = 'none'; }
    var av = $(prefix, 'remoteAvatar');
    if (av) av.style.display = '';
    var ph = $(prefix, 'localPh');
    if (ph) { ph.style.display = 'flex'; ph.innerHTML = '<i class="fas fa-video-slash"></i>'; }
  }

  function stopUnsubs() {
    if (S.unsubDoc) { try { S.unsubDoc(); } catch (e) {} S.unsubDoc = null; }
    if (S.unsubCand) { try { S.unsubCand(); } catch (e) {} S.unsubCand = null; }
  }

  function resetPc() {
    if (S.pc) { try { S.pc.close(); } catch (e2) {} S.pc = null; }
    if (S.localStream) {
      S.localStream.getTracks().forEach(function (t) { t.stop(); });
      S.localStream = null;
    }
  }

  function cleanup(prefix) {
    stopUnsubs();
    resetPc();
    detachStreams(prefix || S.prefix);
    showOverlay(prefix || S.prefix, false);
    S.db = null;
    S.roomId = null;
    S.callId = null;
    S.role = null;
  }

  function docRef() {
    return S.db.collection('VideoCalls').doc(S.roomId);
  }

  function candRef() {
    return docRef().collection('candidates');
  }

  function listenIce(pc) {
    pc.onicecandidate = function (ev) {
      if (!ev.candidate || !S.db || !S.callId) return;
      candRef().add({
        callId: S.callId,
        from: S.role,
        candidate: ev.candidate.toJSON(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    };
  }

  function listenRemoteTracks(pc, prefix) {
    pc.ontrack = function (ev) {
      var stream = ev.streams && ev.streams[0];
      if (stream) attachRemote(prefix, stream);
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'connected') setStatus(prefix, 'Connected');
      if (pc.connectionState === 'failed') setStatus(prefix, 'Connection failed — try again');
    };
  }

  function watchCandidates(pc, prefix) {
    var seen = {};
    S.unsubCand = candRef().orderBy('createdAt').onSnapshot(function (snap) {
      snap.docChanges().forEach(function (ch) {
        if (ch.type !== 'added') return;
        var d = ch.doc.data() || {};
        if (d.callId !== S.callId || d.from === S.role) return;
        if (seen[ch.doc.id]) return;
        seen[ch.doc.id] = true;
        if (!d.candidate || !pc || pc.signalingState === 'closed') return;
        pc.addIceCandidate(new RTCIceCandidate(d.candidate)).catch(function () {});
      });
    });
  }

  function watchDoc(pc, prefix, onRemoteEnd) {
    S.unsubDoc = docRef().onSnapshot(function (snap) {
      var data = snap.data();
      if (!data || data.callId !== S.callId) return;
      if (data.status === 'ended') {
        if (onRemoteEnd) onRemoteEnd();
        global.HOCVideoCall.end(prefix);
        return;
      }
      if (data.answer && pc && !pc.currentRemoteDescription) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer)).then(function () {
          setStatus(prefix, 'Connected');
        }).catch(function () {});
      }
    });
  }

  async function getUserMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This browser does not support video calls.');
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  }

  async function newSession(opts) {
    S.callId = String(Date.now());
    await docRef().set({
      callId: S.callId,
      offer: firebase.firestore.FieldValue.delete(),
      answer: firebase.firestore.FieldValue.delete(),
      status: 'ringing',
      caller: S.role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function startAsCaller(opts) {
    var prefix = opts.prefix || '';
    S.db = opts.db;
    S.roomId = opts.roomId;
    S.role = opts.role;
    S.prefix = prefix;

    if (opts.remoteName) {
      var rn = $(prefix, 'remoteName');
      if (rn) rn.textContent = opts.remoteName;
    }

    showOverlay(prefix, true);
    setStatus(prefix, 'Starting camera…');

    try {
      S.localStream = await getUserMedia();
      attachLocal(prefix, S.localStream);
    } catch (err) {
      setStatus(prefix, 'Allow camera & microphone to start video');
      if (opts.onError) opts.onError(err);
      showOverlay(prefix, false);
      throw err;
    }

    await newSession(opts);

    S.pc = new RTCPeerConnection(ICE);
    listenIce(S.pc);
    listenRemoteTracks(S.pc, prefix);
    S.localStream.getTracks().forEach(function (t) { S.pc.addTrack(t, S.localStream); });

    watchCandidates(S.pc, prefix);
    watchDoc(S.pc, prefix, opts.onRemoteEnd);

    var offer = await S.pc.createOffer();
    await S.pc.setLocalDescription(offer);
    await docRef().set({
      offer: { type: offer.type, sdp: offer.sdp },
      status: 'ringing',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    setStatus(prefix, 'Calling… waiting for the other party');
    if (opts.onRinging) opts.onRinging();
  }

  async function startAsCallee(opts, data) {
    var prefix = opts.prefix || '';
    S.db = opts.db;
    S.roomId = opts.roomId;
    S.role = opts.role;
    S.prefix = prefix;
    S.callId = data.callId;

    if (opts.remoteName) {
      var rn = $(prefix, 'remoteName');
      if (rn) rn.textContent = opts.remoteName;
    }

    showOverlay(prefix, true);
    setStatus(prefix, 'Joining video call…');

    try {
      S.localStream = await getUserMedia();
      attachLocal(prefix, S.localStream);
    } catch (err) {
      setStatus(prefix, 'Allow camera & microphone to join');
      if (opts.onError) opts.onError(err);
      showOverlay(prefix, false);
      throw err;
    }

    S.pc = new RTCPeerConnection(ICE);
    listenIce(S.pc);
    listenRemoteTracks(S.pc, prefix);
    S.localStream.getTracks().forEach(function (t) { S.pc.addTrack(t, S.localStream); });

    watchCandidates(S.pc, prefix);
    watchDoc(S.pc, prefix, opts.onRemoteEnd);

    await S.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    var answer = await S.pc.createAnswer();
    await S.pc.setLocalDescription(answer);
    await docRef().set({
      answer: { type: answer.type, sdp: answer.sdp },
      status: 'connected',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    setStatus(prefix, 'Connected');
  }

  global.HOCVideoCall = {
    /** Start or join a video call on the given chat room id. */
    start: function (opts) {
      if (!opts || !opts.db || !opts.roomId || !opts.role) {
        return Promise.reject(new Error('Video call not configured'));
      }
      cleanup(opts.prefix || '');
      return opts.db.collection('VideoCalls').doc(opts.roomId).get().then(function (snap) {
        var data = snap.exists ? snap.data() : null;
        if (data && data.offer && data.status === 'ringing' && data.caller !== opts.role && data.callId) {
          return startAsCallee(opts, data);
        }
        return startAsCaller(opts);
      });
    },

    end: function (prefix) {
      prefix = prefix || S.prefix || '';
      if (S.db && S.roomId) {
        docRef().set({
          status: 'ended',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function () {});
      }
      cleanup(prefix);
    },

    /** Listen for incoming ring while chat is open. */
    watchIncoming: function (opts) {
      if (!opts || !opts.db || !opts.roomId) return function () {};
      var unsub = opts.db.collection('VideoCalls').doc(opts.roomId).onSnapshot(function (snap) {
        var data = snap.exists ? snap.data() : null;
        if (!data || data.status !== 'ringing' || !data.offer) return;
        if (data.caller === opts.role) return;
        if (opts.onIncoming) opts.onIncoming(data);
      });
      return function () { try { unsub(); } catch (e) {} };
    },

    toggleMic: function (prefix) {
      if (!S.localStream) return false;
      var track = S.localStream.getAudioTracks()[0];
      if (!track) return false;
      track.enabled = !track.enabled;
      return track.enabled;
    },

    toggleCam: function (prefix) {
      if (!S.localStream) return false;
      var track = S.localStream.getVideoTracks()[0];
      if (!track) return false;
      track.enabled = !track.enabled;
      return track.enabled;
    },

    isActive: function () { return !!S.pc; }
  };
})(window);
