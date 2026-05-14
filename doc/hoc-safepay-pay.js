/** HealthOnCall — Safepay checkout (Vercel /api/create-safepay-payment + verify). */
(function (global) {
  'use strict';

  global.HOC_safepayPaidSession = function () {
    try {
      var raw = sessionStorage.getItem('hoc_safepay_paid') || '';
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  global.HOC_clearSafepayPaidSession = function () {
    try { sessionStorage.removeItem('hoc_safepay_paid'); } catch (e) {}
  };

  global.HOC_captureSafepayReturn = function () {
    try {
      var qs = new URLSearchParams(global.location.search);
      if (qs.get('safepay') !== 'success') return null;
      var tracker = qs.get('tracker') || '';
      if (!tracker) return null;

      return fetch('/api/verify-safepay-payment?tracker=' + encodeURIComponent(tracker))
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (out) {
          if (!out.res.ok || !out.data.success) return null;
          var row = { tracker: tracker, paidAt: new Date().toISOString() };
          sessionStorage.setItem('hoc_safepay_paid', JSON.stringify(row));
          qs.delete('safepay');
          qs.delete('tracker');
          var clean = global.location.pathname + (qs.toString() ? '?' + qs.toString() : '') + global.location.hash;
          global.history.replaceState({}, '', clean);
          return row;
        })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  };

  global.HOC_startSafepayCheckout = function (opts) {
    opts = opts || {};
    var amount = Math.max(0, parseInt(opts.amount, 10) || 0);
    if (!amount) return Promise.reject(new Error('Invalid payment amount'));

    var base = global.location.origin + global.location.pathname;
    var body = {
      amount: amount,
      successUrl: base + '?safepay=success',
      cancelUrl: base + '?safepay=cancel'
    };

    return fetch('/api/create-safepay-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'Safepay checkout failed');
        return data;
      });
    }).then(function (data) {
      if (data.checkoutUrl) {
        global.location.href = data.checkoutUrl;
        return data;
      }
      throw new Error('No Safepay checkout URL returned');
    });
  };
})(typeof window !== 'undefined' ? window : this);
