const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
//const { Firestore } = require('@google-cloud/firestore');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password, app } = req.body;

console.log('Request body:', req.body);
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    // Trim whitespace and ensure case sensitivity
    const trimmedPhone = phone.trim();

    // Fetch user by phone number
    const userSnapshot = await firestore.collection('Employee').where('Phone', '==', trimmedPhone).get();

    console.log(`Found ${userSnapshot.size} user(s)`); // Log the number of users found


    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    console.log('User data:', userData);
    console.log(userDoc);

    // Create a dummy email from the phone number
    const email = `${trimmedPhone}@xyz.in`;

    // Check password
    const passwordMatch = await bcrypt.compare(password, userData.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Check role and app access
    const role = userData.role.toLowerCase();
    if (role !== app) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(userDoc.id, { role: userData.role });

    return res.status(200).json({ token: customToken, role: userData.role });
  } catch (error) {
    console.error('Error signing in:', error);
    return res.status(500).json({ error: 'Server error' });
  }

};