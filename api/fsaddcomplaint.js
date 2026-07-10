const crypto = require('crypto');
const verifyToken = require('./middleware/verifytoken');
const corsMiddleware = require('./middleware/cors').default;
const { Firestore } = require('firestore');
const axios = require('axios');
const admin = require('firebase-admin');

// Disable automatic body parsing to extract raw body for signature verification
const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  let cleaned = String(phone || '').replace(/\D/g, '');

  // Strip leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If it's a 10 digit number, prepend '91' (assuming India as default)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.project_id,
    privateKey: process.env.firebase_private_key.replace(/\\n/g, '\n'), // Handle newlines
    clientEmail: process.env.client_email,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { type } = req.query;

  // A. Meta Webhook Path (Bypasses Firebase Auth)
  if (type === 'meta') {
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
  }

  // B. Standard Complaint Registration Path (Requires Firebase Auth)
  if (req.method === 'POST') {
    try {
      const rawBody = await getRawBody(req);
      try {
        req.body = JSON.parse(rawBody.toString('utf8'));
      } catch (parseErr) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      // Call the token verification middleware manually
      return new Promise((resolve) => {
        verifyToken(req, res, async () => {
          try {
            const currentDate = new Date();
            const data = {
              "Customer name": req.body.fields['Customer name'],
              "Phone": req.body.fields['Phone'],
              "address": req.body.fields['address'],
              "pincode": req.body.fields['pincode'],
              "city": req.body.fields['city'],
              "Brand": req.body.fields['Brand'],
              "Category": req.body.fields['Category'],
              "Product name": req.body.fields['Product name'],
              "Purchase date": new Date(req.body.fields['Purchase date']).toISOString(),
              "warranty expiry date": new Date(req.body.fields['warranty expiry date']).toISOString(),
              "Complain/Remark": req.body.fields['Complain/Remark'],
              "Request Type": req.body.fields['Request Type'],
              "date of complain": currentDate
            };

            console.log('Data to be inserted:', data);

            // Insert data into Firestore
            const docRef = await firestore.collection('Admin').add(data);

            console.log('Document written with ID:', docRef.id);

            // Send WhatsApp notification
            const customerPhone = data['Phone'];
            const customerName = data['Customer name'];

            if (customerPhone) {
              const WHATSAPP_ACCESS_TOKEN =
                process.env['access token'] ||
                process.env.access_token ||
                process.env.ACCESS_TOKEN ||
                process.env.WHATSAPP_ACCESS_TOKEN;

              const WHATSAPP_PHONE_NUMBER_ID =
                process.env['whatsapp phone number id'] ||
                process.env.whatsapp_phone_number_id ||
                process.env.WHATSAPP_PHONE_NUMBER_ID ||
                '1107715999101849';

              if (!WHATSAPP_ACCESS_TOKEN) {
                console.warn('WhatsApp access token is not configured (checked process.env["access token"], process.env.access_token, process.env.ACCESS_TOKEN, process.env.WHATSAPP_ACCESS_TOKEN).');
              } else {
                try {
                  const normalizedPhone = normalizePhoneNumber(customerPhone);
                  const name = customerName || 'Customer';

                  console.log(`Sending WhatsApp notification to ${normalizedPhone} (Name: ${name})...`);

                  const whatsappResponse = await axios.post(
                    `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
                    {
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      to: normalizedPhone,
                      type: 'template',
                      template: {
                        name: 'complaint_registration',
                        language: {
                          code: 'en'
                        },
                        components: [
                          {
                            type: 'body',
                            parameters: [
                              {
                                type: 'text',
                                text: name
                              }
                            ]
                          }
                        ]
                      }
                    },
                    {
                      headers: {
                        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );

                  console.log('WhatsApp notification sent successfully:', whatsappResponse.data);
                } catch (waError) {
                  console.error('Failed to send WhatsApp notification:', waError.response?.data || waError.message);
                }
              }
            } else {
              console.warn('No Phone field provided, skipping WhatsApp notification.');
            }

            res.status(200).json({
              message: 'Complaint added successfully',
              id: docRef.id
            });
            resolve();
          } catch (handlerError) {
            console.error('Error adding complaint:', handlerError);
            res.status(500).json({ error: handlerError.message });
            resolve();
          }
        });
      });

    } catch (error) {
      console.error('Request processing error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

const exportedHandler = (req, res) => {
  corsMiddleware(req, res, () => handler(req, res));
};

exportedHandler.config = config;

module.exports = exportedHandler;