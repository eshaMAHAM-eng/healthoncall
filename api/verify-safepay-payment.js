/** Safepay — verify tracker after redirect. Set SAFEPAY_SECRET_KEY on Vercel. */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.SAFEPAY_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'SAFEPAY_SECRET_KEY is not configured on the server' });
    return;
  }

  try {
    const body = req.method === 'GET' ? req.query : (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}));
    const tracker = String(body.tracker || '').trim();
    if (!tracker) {
      res.status(400).json({ error: 'tracker required' });
      return;
    }

    const env = String(process.env.SAFEPAY_ENV || 'sandbox').toLowerCase();
    const base = env === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';

    const verifyRes = await fetch(base + '/order/v1/' + encodeURIComponent(tracker), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' }
    });

    const payment = await verifyRes.json().catch(function () { return {}; });
    if (!verifyRes.ok) {
      res.status(verifyRes.status || 500).json({ error: payment.message || payment.error || 'Verify failed' });
      return;
    }

    const status = payment.state && payment.state.status ? payment.state.status : payment.status;
    const paid = status === 'paid' || status === 'PAID';
    res.status(200).json({ success: paid, status: status || 'unknown', tracker: tracker });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Safepay verify error' });
  }
};
