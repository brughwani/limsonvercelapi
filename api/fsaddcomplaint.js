const { Firestore } = require('firestore');
const withAuth = require('./middleware/withAuth');
const axios = require('axios');

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



const admin = require('firebase-admin');


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

// Initialize Firestore
//const firestore = new Firestore();
// const firestore = new Firestore({
//     projectId: process.env.FIRESTORE_PROJECT_ID,
//     credentials: {
//       client_email: process.env.FIRESTORE_CLIENT_EMAIL,
//       private_key: process.env.FIRESTORE_PRIVATE_KEY.replace(/\\n/g, '\n')
//     }
//   });

  const firestore = admin.firestore();
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        '1124450777425852';
      
      if (!WHATSAPP_ACCESS_TOKEN) {
        console.warn('WhatsApp access token is not configured (checked process.env["access token"], process.env.access_token, process.env.ACCESS_TOKEN, process.env.WHATSAPP_ACCESS_TOKEN).');
      } else {
        try {
          const normalizedPhone = normalizePhoneNumber(customerPhone);
          const name = customerName || 'Customer';
          
          console.log(`Sending WhatsApp notification to ${normalizedPhone} (Name: ${name})...`);
          
          const whatsappResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
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

    return res.status(200).json({
      message: 'Complaint added successfully',
      id: docRef.id
    });

  } catch (error) {
    console.error('Error adding complaint:', error);
    return res.status(500).json({ error: error.message });
  }
};
module.exports = withAuth(handler);