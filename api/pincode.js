// /api/getCityByPincode.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    //const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

  // Get category from query parameters
//  let pin = req.query.pincode || null;
const agent = new https.Agent({
  keepAlive: true, // Enable connection reuse
});

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }


  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }



  const { pincode } = req.query;

  if (!pincode) {
    return res.status(400).json({ error: 'Pincode is required' });
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`,{ agent });
    const data = await response.json();

    if (data[0].Status !== "Success") {
      return res.status(404).json({ error: 'City not found for this pincode' });
    }
    

    // Extract the city or region name from the data
    const city = data[0]['Post Office']['Circle']; // Modify based on API response structure
    return res.status(200).json({ city });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
