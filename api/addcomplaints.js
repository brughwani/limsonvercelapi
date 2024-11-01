const Airtable = require('airtable');

// Configure the Airtable base with your API key and base ID
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

  
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    try {
        console.log('Request body:', req.body);
    
        if (!req.body.fields) {
          throw new Error('Missing fields object in request body');
        }

        const 
        {
          'Customer Name':name,
          'Phone Number':phone,
         
          'address':address,
          'Pincode':pincode,
          'City':city,
          'Purchase Date':purchasedate,
          'warranty expiry date':warrantyexpirydate,
          'product name':productname,
          'category':category,
         
          'Complaint':complaint,
          'Request type':requesttype,
        }= req.body.fields;

        const data={
          "Customer name": name,
      "Phone Number":phone,
     
      "address": address,
      "pincode": pincode,
      "City": city,
      "Purchase Date": purchasedate,
      "warranty expiry date": warrantyexpirydate,
      "category": category,
      "product name": productname,
     
      "Complain/Remark": complaint,
      "Request Type": requesttype,
        }

          console.log('Data to be inserted:', data);

    // Insert the data into the 'Employee' table
    const record = await base('Service').create(data, {typecast: true});

    // If successful, send the ID of the created record as the response
    res.status(200).json({ id: record.getId() });
  } catch (error) {
    
    

    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
