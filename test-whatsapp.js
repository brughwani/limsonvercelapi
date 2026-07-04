const axios = require('axios');

const WHATSAPP_ACCESS_TOKEN = process.env.access_token || process.env.ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = '1575309460840542';
const RECIPIENT_PHONE = process.argv[2]; // pass phone number as command line argument

if (!WHATSAPP_ACCESS_TOKEN) {
  console.error("Error: Please provide 'access_token' environment variable.");
  console.log("Usage: access_token=\"your_token\" node test-whatsapp.js <recipient_phone_number>");
  process.exit(1);
}

if (!RECIPIENT_PHONE) {
  console.error("Error: Please specify the recipient phone number.");
  console.log("Usage: access_token=\"your_token\" node test-whatsapp.js <recipient_phone_number>");
  process.exit(1);
}

function normalizePhoneNumber(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

async function testSend() {
  const normalizedPhone = normalizePhoneNumber(RECIPIENT_PHONE);
  console.log(`Sending test WhatsApp template to ${normalizedPhone}...`);
  
  try {
    const response = await axios.post(
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
                  text: 'John Doe'
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
    console.log('Success! Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error sending WhatsApp message:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testSend();
