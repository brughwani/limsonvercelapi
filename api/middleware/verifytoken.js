const admin = require('firebase-admin');
const withAuth = require('./withAuth');
const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');
import corsMiddleware from './cors';
const tokenCache = new NodeCache(); // No default TTL, we'll set it dynamically



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
 //const firestore = admin.firestore();

 const verifyToken = async (req, res, next) => {
  corsMiddleware(req, res, async () => {
  const authHeader = req.headers.authorization;

  

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

    // Check if the token is in the cache
    const cachedToken = tokenCache.get(token);
    if (cachedToken) {
      req.user = cachedToken;
      return next();
    }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // your secret from signing step
     

   // const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    const expiresIn = decodedToken.exp * 1000 - Date.now();
    if (expiresIn > 0) {
      // Cache the verified token with the calculated TTL
      tokenCache.set(token, decodedToken, expiresIn / 1000);
    }
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

});
};

module.exports = verifyToken;