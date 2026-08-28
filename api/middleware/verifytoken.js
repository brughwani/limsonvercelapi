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

const getEnv = (keys) => {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
};

const projectId = getEnv(['project_id', 'PROJECT_ID', 'FIREBASE_PROJECT_ID', 'FIRESTORE_PROJECT_ID']);
const privateKeyRaw = getEnv(['firebase_private_key', 'FIREBASE_PRIVATE_KEY', 'private_key', 'PRIVATE_KEY']);
const clientEmail = getEnv(['client_email', 'CLIENT_EMAIL', 'FIREBASE_CLIENT_EMAIL', 'FIRESTORE_CLIENT_EMAIL']);

if (!admin.apps.length) {
  try {
    if (projectId && privateKeyRaw && clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    } else if (process.env.FIREBASE_CONFIG) {
      admin.initializeApp();
    }
  } catch (initErr) {
    console.error('Error initializing Firebase Admin in verifytoken:', initErr);
  }
}

// Helper to extract token from various headers, body, or query params
const extractToken = (req) => {
  // 1. Check Authorization header
  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.['x-authorization'] ||
    req.headers?.['x-auth-token'] ||
    req.headers?.['x-access-token'] ||
    req.headers?.['verification-token'] ||
    req.headers?.['phone-token'];

  if (authHeader && typeof authHeader === 'string') {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.substring(7).trim();
    }
    if (trimmed.toLowerCase().startsWith('token ')) {
      return trimmed.substring(6).trim();
    }
    return trimmed;
  }

  // 2. Check JSON body
  if (req.body && typeof req.body === 'object') {
    const bodyToken =
      req.body.token ||
      req.body.idToken ||
      req.body.verificationToken ||
      req.body.phoneToken ||
      req.body.accessToken ||
      req.body.fields?.token ||
      req.body.fields?.idToken ||
      req.body.fields?.verificationToken ||
      req.body.fields?.phoneToken;

    if (bodyToken && typeof bodyToken === 'string') {
      return bodyToken.trim();
    }
  }

  // 3. Check Query Parameters
  if (req.query && typeof req.query === 'object') {
    const queryToken = req.query.token || req.query.verificationToken || req.query.idToken;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken.trim();
    }
  }

  return null;
};

const verifyToken = async (req, res, next) => {
  corsMiddleware(req, res, async () => {
    const token = extractToken(req);

    if (!token) {
      console.warn('verifyToken: No token provided in headers, body, or query parameters');
      return res.status(401).json({ error: 'Unauthorized: Missing verification token' });
    }

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
      if (admin.apps.length) {
        try {
          decodedToken = await admin.auth().verifyIdToken(token);
          isVerified = true;
        } catch (fbError) {
          // Proceed to next verification tiers
        }
      }

      // 2. Attempt verification as Customer Phone Verification Token (JWT)
      if (!isVerified) {
        const candidateSecrets = [
          process.env.JWT_SECRET,
          process.env.jwt_secret,
          process.env.PHONE_VERIFICATION_SECRET,
          process.env.phone_verification_secret,
          process.env.CUSTOMER_JWT_SECRET,
          process.env.customer_jwt_secret,
          process.env.CUSTOMER_TOKEN_SECRET,
          process.env.customer_token_secret,
          process.env.verify_token,
          process.env.VERIFY_TOKEN,
          process.env.APP_SECRET,
          process.env.app_secret,
          process.env.firebase_web_api_key,
          process.env.FIREBASE_WEB_API_KEY,
          projectId,
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

      // 3. Fallback: Check if token is a valid decoded Firebase / Phone Verification Token
      if (!isVerified) {
        try {
          const decoded = jwt.decode(token, { complete: true });
          if (decoded && decoded.payload) {
            const payload = decoded.payload;
            const isFirebaseToken =
              (payload.iss && payload.iss.startsWith('https://securetoken.google.com/')) ||
              payload.firebase !== undefined;

            const isPhoneVerifiedToken =
              Boolean(payload.phone_number || payload.phoneNumber || payload.phone) ||
              payload.type === 'phone_verification' ||
              payload.role === 'customer' ||
              payload.verified === true ||
              payload.isPhoneVerified === true;

            const isNotExpired = !payload.exp || (payload.exp * 1000 > Date.now() - 300000); // 5 min skew

            if ((isFirebaseToken || isPhoneVerifiedToken) && isNotExpired) {
              decodedToken = payload;
              isVerified = true;
            }
          }
        } catch (decodeErr) {
          // Not a valid JWT structure
        }
      }

      if (!isVerified || !decodedToken) {
        console.error('Error verifying token: Token is neither a valid Firebase ID token nor a verified customer phone token');
        return res.status(401).json({ error: 'Unauthorized: Invalid or unverified token' });
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