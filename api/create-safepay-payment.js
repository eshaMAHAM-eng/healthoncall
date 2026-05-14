/** Safepay — create checkout session (PKR). Set SAFEPAY_API_KEY + SAFEPAY_ENV on Vercel. */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.SAFEPAY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'SAFEPAY_API_KEY is not configured on the server' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const amount = parseInt(body.amount, 10);
    const env = String(process.env.SAFEPAY_ENV || 'sandbox').toLowerCase();
    const base = env === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';

    if (!amount || amount < 1) {
      res.status(400).json({ error: 'Amount must be at least 1 PKR' });
      return;
    }

    const initRes = await fetch(base + '/order/v1/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client: apiKey,
        amount: amount,
        currency: 'PKR',
        environment: env === 'production' ? 'production' : 'sandbox'
      })
    });

    const data = await initRes.json().catch(function () { return {}; });
    if (!initRes.ok) {
      res.status(initRes.status || 500).json({ error: data.message || data.error || 'Safepay init failed' });
      return;
    }

    const token = data.tracker && data.tracker.token ? data.tracker.token : (data.token || '');
    if (!token) {
      res.status(500).json({ error: 'No tracker token from Safepay' });
      return;
    }

    const successUrl = body.successUrl || 'https://healthoncall.vercel.app/patient/book-appointment.html?safepay=success';
    const cancelUrl = body.cancelUrl || 'https://healthoncall.vercel.app/patient/book-appointment.html?safepay=cancel';
    const checkoutBase = env === 'production' ? 'https://www.getsafepay.com/components' : base + '/components';
    const checkoutUrl = checkoutBase
      + '?env=' + encodeURIComponent(env === 'production' ? 'production' : 'sandbox')
      + '&beacon=' + encodeURIComponent(token)
      + '&redirect_url=' + encodeURIComponent(successUrl + (successUrl.indexOf('?') >= 0 ? '&' : '?') + 'tracker=' + encodeURIComponent(token))
      + '&cancel_url=' + encodeURIComponent(cancelUrl);

    res.status(200).json({ token: token, checkoutUrl: checkoutUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Safepay error' });
  }
};
