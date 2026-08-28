const assert = require('assert');
const jwt = require('jsonwebtoken');
const Module = require('module');
const path = require('path');

process.env.JWT_SECRET = 'test_jwt_secret_key_123';
process.env.PHONE_VERIFICATION_SECRET = 'test_phone_secret_key_456';
process.env.verify_token = 'test_verify_token_789';

const mockFirebaseAdmin = {
  apps: { length: 1 },
  initializeApp: () => {},
  credential: {
    cert: () => {}
  },
  auth: () => ({
    verifyIdToken: async (token) => {
      if (token === 'valid_firebase_id_token') {
        return {
          uid: 'firebase_user_123',
          email: 'employee@xyz.in',
          role: 'karigar',
          exp: Math.floor(Date.now() / 1000) + 3600
        };
      }
      const err = new Error('Firebase ID token verification failed');
      err.code = 'auth/invalid-id-token';
      throw err;
    }
  })
};

const mockCorsMiddleware = (req, res, next) => next();

// Overwrite Module.prototype.require to inject mocks
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'firebase-admin') {
    return mockFirebaseAdmin;
  }
  if (id.endsWith('middleware/cors') || id === './cors') {
    return { default: mockCorsMiddleware };
  }
  return originalRequire.apply(this, arguments);
};

const verifyToken = require(path.resolve(__dirname, 'api/middleware/verifytoken'));

function createMockResponse(cb) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, val) {
      this.headers[name] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      cb(this);
    }
  };
}

async function runTests() {
  console.log('--- Starting Token Verification Middleware Tests ---\n');

  // Test 1: Missing Token -> 401
  await new Promise((resolve) => {
    const req = { headers: {} };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 401);
      assert.ok(finalRes.body.error.includes('Missing verification token'));
      console.log('✅ Test 1 Passed: Missing Authorization Header returns 401');
      resolve();
    });
    verifyToken(req, res, () => {
      assert.fail('Should not call next() when token is missing');
    });
  });

  // Test 2: Token without Bearer prefix (raw token in Authorization header)
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phone: '9876543210',
      type: 'phone_verification',
      role: 'customer',
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.JWT_SECRET);

    const req = { headers: { authorization: phoneToken } };
    const res = createMockResponse(() => {
      assert.fail('Should not fail on raw Authorization header');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated');
      assert.strictEqual(req.user.phone, '9876543210');
      console.log('✅ Test 2 Passed: Raw Authorization header without Bearer prefix successfully verified');
      resolve();
    });
  });

  // Test 3: Valid Firebase ID Token
  await new Promise((resolve) => {
    const req = { headers: { authorization: 'Bearer valid_firebase_id_token' } };
    const res = createMockResponse(() => {
      assert.fail('Should not send response on success');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be set');
      assert.strictEqual(req.user.uid, 'firebase_user_123');
      assert.strictEqual(req.user.email, 'employee@xyz.in');
      console.log('✅ Test 3 Passed: Valid Firebase ID Token successfully verified');
      resolve();
    });
  });

  // Test 4: Customer Phone Verification Token signed with JWT_SECRET
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phone: '9876543210',
      type: 'phone_verification',
      role: 'customer',
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${phoneToken}` } };
    const res = createMockResponse(() => {
      assert.fail('Should not send error response on success');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from customer phone verification token');
      assert.strictEqual(req.user.phone, '9876543210');
      assert.strictEqual(req.user.type, 'phone_verification');
      assert.strictEqual(req.user.role, 'customer');
      console.log('✅ Test 4 Passed: Customer Phone Verification Token (JWT_SECRET) successfully verified');
      resolve();
    });
  });

  // Test 5: Customer Phone Verification Token in x-auth-token header
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phoneNumber: '+919876543210',
      verified: true,
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.PHONE_VERIFICATION_SECRET);

    const req = { headers: { 'x-auth-token': phoneToken } };
    const res = createMockResponse(() => {
      assert.fail('Should not send error response on success');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from x-auth-token');
      assert.strictEqual(req.user.phoneNumber, '+919876543210');
      assert.strictEqual(req.user.verified, true);
      console.log('✅ Test 5 Passed: Customer Phone Token via x-auth-token header successfully verified');
      resolve();
    });
  });

  // Test 6: Customer Phone Verification Token in body.fields.token
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phone: '9988776655',
      role: 'customer',
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.JWT_SECRET);

    const req = {
      headers: {},
      body: {
        fields: {
          token: phoneToken,
          'Customer name': 'Bob'
        }
      }
    };
    const res = createMockResponse(() => {
      assert.fail('Should not send error response on success');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from body.fields.token');
      assert.strictEqual(req.user.phone, '9988776655');
      console.log('✅ Test 6 Passed: Customer Phone Token via body.fields.token successfully verified');
      resolve();
    });
  });

  // Test 7: Decoded Phone Verification JWT Token fallback
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phone_number: '+919876543210',
      firebase: { sign_in_provider: 'phone' },
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    // Signed with external third-party/unknown secret
    const phoneToken = jwt.sign(phoneTokenPayload, 'unknown_external_secret');

    const req = { headers: { authorization: `Bearer ${phoneToken}` } };
    const res = createMockResponse(() => {
      assert.fail('Should not fail fallback validation');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from decoded phone token');
      assert.strictEqual(req.user.phone_number, '+919876543210');
      console.log('✅ Test 7 Passed: Decoded Phone Verification Token fallback successfully verified');
      resolve();
    });
  });

  // Test 8: Cached Token retrieval
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phone: '9123456789',
      customerName: 'Cached User',
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.JWT_SECRET);

    // First call to populate cache
    const req1 = { headers: { authorization: `Bearer ${phoneToken}` } };
    const res1 = createMockResponse(() => {});
    verifyToken(req1, res1, () => {
      assert.strictEqual(req1.user.customerName, 'Cached User');

      // Second call should retrieve from cache
      const req2 = { headers: { authorization: `Bearer ${phoneToken}` } };
      const res2 = createMockResponse(() => {});
      verifyToken(req2, res2, () => {
        assert.strictEqual(req2.user.customerName, 'Cached User');
        console.log('✅ Test 8 Passed: Token caching successfully retrieves user data');
        resolve();
      });
    });
  });

  // Test 9: Firebase ID Token from secondary project 'lmsupportagent' (User Error Case)
  await new Promise((resolve) => {
    const lmSupportTokenPayload = {
      iss: 'https://securetoken.google.com/lmsupportagent',
      aud: 'lmsupportagent',
      auth_time: Math.floor(Date.now() / 1000),
      user_id: 'lmsupport_user_789',
      sub: 'lmsupport_user_789',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      phone_number: '+919876543210',
      firebase: {
        identities: {
          phone: ['+919876543210']
        },
        sign_in_provider: 'phone'
      }
    };
    const lmSupportToken = jwt.sign(lmSupportTokenPayload, 'dummy_key');

    const req = { headers: { authorization: `Bearer ${lmSupportToken}` } };
    const res = createMockResponse(() => {
      assert.fail('Should not fail lmsupportagent token verification');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from lmsupportagent token');
      assert.strictEqual(req.user.aud, 'lmsupportagent');
      assert.strictEqual(req.user.phone_number, '+919876543210');
      assert.strictEqual(req.user.firebase.sign_in_provider, 'phone');
      console.log('✅ Test 9 Passed: Firebase ID Token from lmsupportagent project successfully verified');
      resolve();
    });
  });

  console.log('\n--- All Token Verification Middleware Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('❌ Token Verification Test Failed:', err);
  process.exit(1);
});
