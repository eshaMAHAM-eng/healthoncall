/** HealthOnCall — Stripe Checkout (Vercel serverless /api/create-checkout-session). */
(function (global) {
  'use strict';

  global.HOC_stripePaidSession = function () {
    try {
      var raw = sessionStorage.getItem('hoc_stripe_paid') || '';
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  global.HOC_clearStripePaidSession = function () {
    try { sessionStorage.removeItem('hoc_stripe_paid'); } catch (e) {}
  };

  global.HOC_captureStripeReturn = function () {
    try {
      var qs = new URLSearchParams(global.location.search);
      if (qs.get('stripe') !== 'success') return null;
      var sid = qs.get('session_id') || '';
      if (!sid) return null;
      var row = { sessionId: sid, paidAt: new Date().toISOString() };
      sessionStorage.setItem('hoc_stripe_paid', JSON.stringify(row));
      qs.delete('stripe');
      qs.delete('session_id');
      var clean = global.location.pathname + (qs.toString() ? '?' + qs.toString() : '') + global.location.hash;
      global.history.replaceState({}, '', clean);
      return row;
    } catch (e) {
      return null;
    }
  };

  global.HOC_startStripeCheckout = function (opts) {
    opts = opts || {};
    var amount = Math.max(0, parseInt(opts.amount, 10) || 0);
    if (!amount) return Promise.reject(new Error('Invalid payment amount'));

    var base = global.location.origin + global.location.pathname;
    var body = {
      amount: amount,
      currency: (opts.currency || 'pkr').toLowerCase(),
      description: opts.description || 'HealthOnCall appointment',
      successUrl: base + '?stripe=success&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: base + '?stripe=cancel',
      metadata: opts.metadata || {}
    };

    return fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'Stripe checkout failed');
        return data;
      });
    }).then(function (data) {
      if (data.url) {
        global.location.href = data.url;
        return data;
      }
      throw new Error('No checkout URL returned');
    });
  };
})(typeof window !== 'undefined' ? window : this);
