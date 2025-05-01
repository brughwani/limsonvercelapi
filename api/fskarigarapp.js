const admin = require('firebase-admin');
const withAuth = require('./middleware/withAuth');


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
    const technicianName = req.query.technicianName || (req.user && req.user.name);
    if (!technicianName) {
      return res.status(400).json({ error: 'name required' });
    }
    if (req.method === 'GET') {
        try {
          const snapshot = await firestore
            .collection('Admin')
            .where('allotted to', '==', technicianName)
            .get();
    
          const complaints = [];
          snapshot.forEach(doc => {
            complaints.push({ id: doc.id, ...doc.data() });
          });
    
          return res.status(200).json({ success: true, complaints });
        } catch (error) {
          console.error('Error fetching complaints:', error);
          return res.status(500).json({ error: error.message });
        }
      }
  
    if (req.method === 'PATCH') {
      try {
        const updates = req.body;
        if (!updates.id || !updates.fields) {
          return res.status(400).json({ error: 'Invalid update format' });
        }
        
        console.log('Updates received:', updates);
  
        const docRef = firestore.collection('Admin').doc(updates.id);
        // Use set with merge:true to append new fields (or update existing keys)
        await docRef.set(updates.fields, { merge: true });
  
        return res.status(200).json({
          message: 'Records updated successfully',
          records: { id: updates.id, fields: updates.fields }
        });
      } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({ error: error.message });
      }
    }
  };
  
  module.exports = withAuth(handler);