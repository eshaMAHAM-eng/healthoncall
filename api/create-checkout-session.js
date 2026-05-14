const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured on the server' });
    return;
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const amount = parseInt(body.amount, 10);
    const currency = String(body.currency || 'pkr').toLowerCase();

    if (!amount || amount < 100) {
      res.status(400).json({ error: 'Amount must be at least 100 (smallest currency unit)' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: currency,
          unit_amount: amount,
          product_data: {
            name: body.description || 'HealthOnCall appointment fee'
          }
        }
      }],
      success_url: body.successUrl || 'https://healthoncall.vercel.app/patient/book-appointment.html?stripe=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: body.cancelUrl || 'https://healthoncall.vercel.app/patient/book-appointment.html?stripe=cancel',
      metadata: body.metadata || {}
    });

    res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Stripe error' });
  }
};
