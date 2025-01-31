const admin = require('firebase-admin');
//const withAuth = require('./withAuth');
const withAuth = require('/middleware/withAuth');



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



function isDateInRange(dateToCheck, startDate, endDate) {
  const date = new Date(dateToCheck);
  const start = new Date(startDate);
  const end = new Date(endDate);

  date.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return date >= start && date <= end;
}

const fscomplainfiltering = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const data = {
    "fromdate": req.query['fromdate'],
    "todate": req.query['todate'],
    "Customer name": req.query['Customer name'],
    "Phone Number": req.query['Phone Number'],
    "Location": req.query['Location'],
    "Dealer": req.query['Dealer'],
    "productcategory": req.query['productcategory'],
    "productname": req.query['productname'],
    "allotment": req.query['allotted to'],
    "Request Type": req.query['Service Type'],
    "Source by": req.query['Source by'],
  };

  try {
    const adminRecords = await firestore.collection('admin').get();

    let filteredRecords = [];

    adminRecords.forEach(doc => {
      const record = doc.data();
      let matches = false;

      if (record['Customer name'].toLowerCase().includes(data['Customer name'])) {
        matches = true;
      }

      if (record['City'] === data['Location']) {
        matches = true;
      }

      if (record['category'] === data['productcategory']) {
        matches = true;
        if (data['productname'] === "Select a product") {
          matches = true;
        } else if (record['product name'] === data['productname']) {
          matches = true;
        } else {
          matches = false;
        }
      }

      if (matches && isDateInRange(record['date of complain'], data['fromdate'], data['todate'])) {
        filteredRecords.push({
          "Customer name": record['Customer name'],
          "Phone Number": record['Phone Number'],
          "product name": record['product name'],
          "City": record['City'],
          "category": record['category'],
          "date of complain": record['date of complain']
        });
      }
    });

    res.status(200).json(filteredRecords);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching records from Firestore');
  }
};
module.exports = withAuth(fscomplainfiltering);