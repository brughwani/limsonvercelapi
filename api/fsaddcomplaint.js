const { Firestore } = require('firestore');
//const withAuth = require('./withAuth');
const withAuth = require('../middleware/withAuth');



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
      "Customer Name": req.body.fields['Customer Name'],
      "Phone": req.body.fields['Phone'],
      "address": req.body.fields['address'],
      "pincode": req.body.fields['pincode'],
      "city": req.body.fields['city'],
      "Brand": req.body.fields['Brand'],
      "Category": req.body.fields['Category'],
      "Product name": req.body.fields['Product name'],
      "Purchase date": new Date(req.body.fields['Purchase date']),
      "warranty expiry date": new Date(req.body.fields['warranty expiry date']),
      "Complain/Remark": req.body.fields['Complain/Remark'],
      "Request Type": req.body.fields['Request Type'],
      "date of complain": currentDate
    };

    console.log('Data to be inserted:', data);

    // Insert data into Firestore
    const docRef = await firestore.collection('Admin').add(data);

    console.log('Document written with ID:', docRef.id);

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