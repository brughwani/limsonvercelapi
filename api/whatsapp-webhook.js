const crypto = require('crypto');
const corsMiddleware = require('./middleware/cors').default;

// Configuration for Vercel Serverless Function to disable body parsing

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

const handler = async (req, res) => {
  // 1. GET Request: Webhook verification challenge from Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.verify_token) {
        console.log('Webhook verified successfully!');
        return res.status(200).send(challenge);
      } else {
        console.error('Webhook verification failed: token mismatch');
        return res.status(403).json({ error: 'Verification failed' });
      }
    }
    return res.status(400).json({ error: 'Bad Request' });
  }

  // 2. POST Request: Incoming WhatsApp event notification
  if (req.method === 'POST') {
    try {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        console.error('Missing x-hub-signature-256 header');
        return res.status(401).json({ error: 'Signature missing' });
      }

      const rawBody = await getRawBody(req);
      const appSecret = process.env.APP_SECRET;

      if (!appSecret) {
        console.error('APP_SECRET environment variable is not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Verify HMAC-SHA256 signature
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

      // Use timingSafeEqual to protect against timing attacks
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        console.error('Signature mismatch: Webhook message signature is invalid');
        return res.status(401).json({ error: 'Signature verification failed' });
      }

      // Parse payload
      const payload = JSON.parse(rawBody.toString('utf8'));
      console.log('Verified Webhook Payload:', JSON.stringify(payload, null, 2));

      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

const webhookHandler = (req, res) => {
  corsMiddleware(req, res, () => handler(req, res));
};

webhookHandler.config = {
  api: {
    bodyParser: false, // Required to get the raw body for signature verification
  },
};

module.exports = webhookHandler;
