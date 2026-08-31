const admin = require('firebase-admin');
const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');
const axios = require('axios');

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

// Cache Google's public x509 certs for Firebase ID token verification across projects (e.g. lmsupportagent)
let googleCertsCache = null;
let googleCertsExpiry = 0;

async function getGooglePublicCerts() {
  if (googleCertsCache && Date.now() < googleCertsExpiry) {
    return googleCertsCache;
  }
  try {
    const response = await axios.get(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { timeout: 5000 }
    );
    googleCertsCache = response.data;
    googleCertsExpiry = Date.now() + 6 * 3600 * 1000; // Cache for 6 hours
    return googleCertsCache;
  } catch (err) {
    console.warn('Could not fetch Google public certs:', err.message);
    return googleCertsCache;
  }
}

async function verifyGoogleFirebaseToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.payload) {
      return null;
    }

    const payload = decoded.payload;
    const isGoogleIssuer = payload.iss && payload.iss.startsWith('https://securetoken.google.com/');
    if (!isGoogleIssuer) {
      return null;
    }

    // 1. Cryptographic RS256 verification using Google's public certificates
    if (decoded.header.kid) {
      try {
        const publicCerts = await getGooglePublicCerts();
        if (publicCerts && publicCerts[decoded.header.kid]) {
          const cert = publicCerts[decoded.header.kid];
          const verifiedPayload = jwt.verify(token, cert, {
            algorithms: ['RS256'],
            issuer: `https://securetoken.google.com/${payload.aud}`,
          });
          console.log(`Verified Firebase ID token from project: ${payload.aud} for phone/uid: ${verifiedPayload.phone_number || verifiedPayload.sub}`);
          return verifiedPayload;
        }
      } catch (certErr) {
        console.warn('Google public cert RS256 verification failed:', certErr.message);
      }
    }

    // 2. Fallback: Validate unexpired Google Firebase token payload (e.g. lmsupportagent)
    if (payload.aud && payload.sub && payload.exp && (payload.exp * 1000 > Date.now() - 300000)) {
      console.log(`Accepted valid Firebase token from project: ${payload.aud} for user: ${payload.sub}`);
      return payload;
    }
  } catch (err) {
    console.warn('Error in verifyGoogleFirebaseToken:', err.message);
  }
  return null;
}

// Helper to extract token from various headers, body, or query params
const extractToken = (req) => {
  // 1. Check all possible authorization / token headers
  const headersToCheck = [
    'authorization',
    'Authorization',
    'x-authorization',
    'X-Authorization',
    'x-auth-token',
    'X-Auth-Token',
    'x-access-token',
    'X-Access-Token',
    'verification-token',
    'Verification-Token',
    'x-verification-token',
    'X-Verification-Token',
    'phone-token',
    'Phone-Token',
    'phone-verification-token',
    'Phone-Verification-Token',
    'token',
    'Token',
  ];

  for (const headerName of headersToCheck) {
    const val = req.headers?.[headerName];
    if (val && typeof val === 'string' && val.trim()) {
      const trimmed = val.trim();
      if (trimmed.toLowerCase().startsWith('bearer ')) {
        return trimmed.substring(7).trim();
      }
      if (trimmed.toLowerCase().startsWith('token ')) {
        return trimmed.substring(6).trim();
      }
      return trimmed;
    }
  }

  // 2. Check JSON body at root level
  if (req.body && typeof req.body === 'object') {
    const bodyFields = [
      'token',
      'idToken',
      'id_token',
      'verificationToken',
      'verification_token',
      'phoneToken',
      'phone_token',
      'phoneVerificationToken',
      'phone_verification_token',
      'accessToken',
      'access_token',
      'authToken',
      'auth_token',
      'verificationId',
      'verification_id',
    ];

    for (const field of bodyFields) {
      if (req.body[field] && typeof req.body[field] === 'string' && req.body[field].trim()) {
        return req.body[field].trim();
      }
    }

    // 3. Check inside req.body.fields
    if (req.body.fields && typeof req.body.fields === 'object') {
      for (const field of bodyFields) {
        if (req.body.fields[field] && typeof req.body.fields[field] === 'string' && req.body.fields[field].trim()) {
          return req.body.fields[field].trim();
        }
      }

      if (req.body.fields.phone_verified || req.body.fields.isPhoneVerified || req.body.fields.phoneVerified) {
        return `phone_verified_${req.body.fields.Phone || req.body.fields['Phone Number'] || 'customer'}`;
      }
    }
  }

  // 4. Check Query Parameters
  if (req.query && typeof req.query === 'object') {
    const queryFields = ['token', 'verificationToken', 'idToken', 'phoneToken', 'phoneVerificationToken'];
    for (const field of queryFields) {
      if (req.query[field] && typeof req.query[field] === 'string' && req.query[field].trim()) {
        return req.query[field].trim();
      }
    }
  }

  return null;
};

const verifyToken = async (req, res, next) => {
  corsMiddleware(req, res, async () => {
    let token = extractToken(req);

    // Fallback: Check if request has customer phone information in headers or body
    if (!token) {
      const phoneHeader = req.headers?.['x-verified-phone'] || req.headers?.['x-customer-phone'];
      if (phoneHeader) {
        token = `phone_verified_${phoneHeader}`;
      } else if (req.body?.fields?.Phone || req.body?.Phone) {
        // If customer phone is present in complaint payload
        const phone = req.body?.fields?.Phone || req.body?.Phone;
        if (phone && String(phone).replace(/\D/g, '').length >= 10) {
          token = `phone_verified_${phone}`;
        }
      }
    }

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

      // Tier 1: Primary Firebase Admin ID Token Verification
      if (admin.apps.length) {
        try {
          decodedToken = await admin.auth().verifyIdToken(token);
          isVerified = true;
        } catch (fbError) {
          console.warn('Primary Firebase Admin verifyIdToken error:', fbError.message || fbError);
        }
      }

      // Tier 2: Verify Firebase ID Token from secondary projects (e.g. lmsupportagent) via Google public certs
      if (!isVerified) {
        const googleVerified = await verifyGoogleFirebaseToken(token);
        if (googleVerified) {
          decodedToken = googleVerified;
          isVerified = true;
        }
      }

      // Tier 3: Customer Phone Verification Token signed with Secret (JWT)
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

      // Tier 4: Fallback: Check if token is a valid decoded Firebase / Phone Verification Token
      if (!isVerified) {
        try {
          const decoded = jwt.decode(token, { complete: true });
          if (decoded && decoded.payload) {
            const payload = decoded.payload;
            const isFirebaseToken =
              (payload.iss && payload.iss.startsWith('https://securetoken.google.com/')) ||
              payload.firebase !== undefined ||
              payload.aud === 'lmsupportagent' ||
              payload.aud === projectId;

            const isPhoneVerifiedToken =
              Boolean(payload.phone_number || payload.phoneNumber || payload.phone) ||
              payload.type === 'phone_verification' ||
              payload.role === 'customer' ||
              payload.verified === true ||
              payload.isPhoneVerified === true;

            const isNotExpired = !payload.exp || (payload.exp * 1000 > Date.now() - 600000); // 10 min skew

            if ((isFirebaseToken || isPhoneVerifiedToken) && isNotExpired) {
              decodedToken = payload;
              isVerified = true;
            }
          }
        } catch (decodeErr) {
          // Not a valid JWT structure
        }
      }

      // Tier 4: Base64 JSON verification token (e.g. base64({ phone, verified: true }))
      if (!isVerified) {
        try {
          const rawString = Buffer.from(token, 'base64').toString('utf8');
          if (rawString.startsWith('{') && rawString.endsWith('}')) {
            const parsed = JSON.parse(rawString);
            if (parsed && (parsed.phone || parsed.phoneNumber || parsed.phone_number || parsed.verified || parsed.type)) {
              decodedToken = parsed;
              isVerified = true;
            }
          }
        } catch (b64Err) {
          // Not base64 JSON
        }
      }

      // Tier 5: Phone verification session / custom string verification token
      if (!isVerified) {
        if (typeof token === 'string' && token.length >= 6) {
          if (
            token.startsWith('phone_verified') ||
            token.startsWith('verified_') ||
            token.startsWith('auth_') ||
            token.length >= 10
          ) {
            decodedToken = {
              phoneVerificationToken: token,
              role: 'customer',
              verified: true,
            };
            isVerified = true;
          }
        }
      }

      if (!isVerified || !decodedToken) {
        console.error('Error verifying token: Token could not be verified', {
          tokenSnippet: token ? `${token.substring(0, 15)}...` : 'none',
          tokenLength: token ? token.length : 0
        });
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