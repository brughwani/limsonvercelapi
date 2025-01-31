const admin = require('firebase-admin');
const withAuth = require('../middleware/withAuth');


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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
  
    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }
  
    try {
      const adminRecords = await firestore.collection('admin').get();
  
      const retrievedRecords = adminRecords.docs.map(doc => ({
        id: doc.id,
        fields: doc.data()
      }));
  
      if (retrievedRecords.length > 0) {
        res.status(200).json(retrievedRecords);
      } else {
        res.status(404).json({ message: 'No records found' });
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  module.exports = withAuth(handler);
  

