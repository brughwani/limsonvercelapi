const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIRESTORE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newlines
    clientEmail: process.env.FIRESTORE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
  const firestore = admin.firestore();


async function getCurrentRecordDetails(recordIds) {
  try {
    if (!recordIds) {
      throw new Error('recordIds is required');
    }

    const recordIdsArray = Array.isArray(recordIds) ? recordIds : recordIds.split(',');

    const records = await firestore.collection('admin').where('__name__', 'in', recordIdsArray).get();

    if (records.empty) {
      throw new Error('No records found');
    }

    return records.docs.map(doc => ({
      recordId: doc.id,
      currentStatus: doc.data().Status || null,
      currentAllotment: doc.data()['alloted to'] || null
    }));
  } catch (error) {
    console.error('Error fetching record details:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const { recordIds } = req.query;
    if (!recordIds) {
      return res.status(400).json({ error: 'Record IDs required' });
    }

    try {
      const currentDetails = await getCurrentRecordDetails(recordIds);
      return res.status(200).json({ success: true, currentDetails });
    } catch (error) {
      console.error('Error fetching record:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const updates = req.body;
      if (!updates.id || !updates.fields) {
        return res.status(400).json({ error: 'Invalid update format' });
      }

      const docRef = firestore.collection('admin').doc(updates.id);
      await docRef.update(updates.fields);

      return res.status(200).json({
        message: 'Records updated successfully',
        records: { id: updates.id, fields: updates.fields }
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }
};