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





module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
    const { locality, getLocations, getAllDealers } = req.query;

    if (getAllDealers === 'true') {
      const dealersByLocation = {};
      const records = await firestore.collection('Dealer').get();

      records.forEach(doc => {
        const record = doc.data();
        const location = record.locality;
        const dealerInfo = {
          id: doc.id,
          dealerName: record['Dealer name'],
          location: location
        };

        if (location) {
          if (!dealersByLocation[location]) {
            dealersByLocation[location] = [];
          }
          dealersByLocation[location].push(dealerInfo);
        }
      });

      return res.status(200).json(dealersByLocation);
    }

    if (getLocations === 'true') {
      const locations = new Set();
      const records = await firestore.collection('Dealer').get();

      records.forEach(doc => {
        const location = doc.data().locality;
        if (location) {
          locations.add(location);
        }
      });

      return res.status(200).json(Array.from(locations));
    }

    if (locality) {
      const records = await firestore.collection('Dealer').where('locality', '==', locality).get();
      const dealers = records.docs.map(doc => ({
        id: doc.id,
        dealerName: doc.data()['Dealer name'],
        location: doc.data().locality
      }));

      return res.status(200).json(dealers);
    }

    res.status(400).json({ error: 'Missing required query parameters' });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: 'Server error' });
  }
};