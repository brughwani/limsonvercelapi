const admin = require('firebase-admin');
const { Firestore } = require('@google-cloud/firestore');

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIRESTORE_PROJECT_ID,
    privateKey: process.env.FIRESTORE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newlines
    clientEmail: process.env.FIRESTORE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

module.exports = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    // Fetch user by refresh token
    const refreshTokenSnapshot = await firestore.collection('refreshTokens').where('refreshToken', '==', refreshToken).get();

    if (refreshTokenSnapshot.empty) {
      return res.status(400).json({ error: 'Invalid refresh token' });
    }

    const refreshTokenDoc = refreshTokenSnapshot.docs[0];
    const userId = refreshTokenDoc.id;

    // Fetch user data
    const userDoc = await firestore.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Generate new custom token
    const newCustomToken = await admin.auth().createCustomToken(userId, { role: userData.role });

    return res.status(200).json({ token: newCustomToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};