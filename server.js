const express = require('express');
const stripe = require('stripe')('sk_test_51KMlybG10HkvGOJs2Q494QP58QKkfgCn0NJk9OGm0JmLhskUDRrLbjJekywGio47kEPK7U2jtYnkwucMX0dxeBap005EhShqhC');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const app = express();
app.use(express.json());

const port = 3002;

// Stripe Payment Intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    console.log(amount)
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      // Add other payment intent settings if needed
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//Publishable Key
//pk_test_51KMlybG10HkvGOJsm2vFQGFuidsckj4HrqlCwpuDRsaTbSMyCP1fyUrLRQBsPooHe56ZeqVS5GlLCYjjckrdxQ5Q00SxvfEV2B

// Agora Token Generation
const appId = '3916edce83ef4f17b0b05e5c1eaa9c68';
const appCertificate = '007fdbfd85f04111bf03d77af6eaded7';
const expirationTimeInSeconds = 3600;
const currentTimestamp = Math.floor(Date.now() / 1000);
const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

app.get('/get-token', (req, res) => {
  const channelName = req.query.channelName;
  const uid = req.query.uid || 0;

  if (!channelName) {
    return res.status(400).send('Channel name is required');
  }

  const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, RtcRole.PUBLISHER, privilegeExpiredTs);
  res.json({ token });
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
