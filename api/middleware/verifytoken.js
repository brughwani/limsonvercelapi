const admin = require('firebase-admin');
const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');

let corsMiddleware;
try {
  const corsModule = require('./cors');
  corsMiddleware = corsModule.default || corsModule;
} catch (e) {
  const cors = require('cors');
  corsMiddleware = cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
const tokenCache = new NodeCache(); // Dynamic TTL based on token expiry

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.project_id,
      privateKey: process.env.firebase_private_key
        ? process.env.firebase_private_key.replace(/\\n/g, '\n')
        : undefined,
      clientEmail: process.env.client_email,
    };
    if (serviceAccount.projectId && serviceAccount.privateKey && serviceAccount.clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  } catch (initErr) {
    console.error('Error initializing Firebase Admin:', initErr);
  }
}

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
      let decodedToken = null;
      let isVerified = false;

      // 1. Attempt verification with Firebase Admin (Firebase ID token)
      try {
        if (admin.apps.length) {
          decodedToken = await admin.auth().verifyIdToken(token);
          isVerified = true;
        }
      } catch (fbError) {
        // Not a Firebase ID token or Firebase verification failed
      }

      // 2. Attempt verification as Customer Phone Verification Token (JWT)
      if (!isVerified) {
        const candidateSecrets = [
          process.env.JWT_SECRET,
          process.env.jwt_secret,
          process.env.PHONE_VERIFICATION_SECRET,
          process.env.CUSTOMER_JWT_SECRET,
          process.env.CUSTOMER_TOKEN_SECRET,
          process.env.verify_token,
          process.env.APP_SECRET,
        ].filter(Boolean);

        const uniqueSecrets = [...new Set(candidateSecrets)];
        for (const secret of uniqueSecrets) {
          try {
            decodedToken = jwt.verify(token, secret);
            isVerified = true;
            break;
          } catch (jwtError) {
            // Try next secret
          }
        }
      }

      if (!isVerified || !decodedToken) {
        console.error('Error verifying token: Token is neither a valid Firebase ID token nor a valid customer phone verification token');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.user = decodedToken;

      // Calculate cache TTL
      let cacheTtlSeconds = 3600;
      if (decodedToken && decodedToken.exp) {
        const expiresInMs = decodedToken.exp * 1000 - Date.now();
        if (expiresInMs > 0) {
          cacheTtlSeconds = Math.floor(expiresInMs / 1000);
        } else {
          cacheTtlSeconds = 0;
        }
      }

      if (cacheTtlSeconds > 0) {
        tokenCache.set(token, decodedToken, cacheTtlSeconds);
      }

      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  });
};

module.exports = verifyToken;