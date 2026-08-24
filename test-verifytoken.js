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

  // Test 1: Missing Authorization Header -> 401
  await new Promise((resolve) => {
    const req = { headers: {} };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 401);
      assert.deepStrictEqual(finalRes.body, { error: 'Unauthorized' });
      console.log('✅ Test 1 Passed: Missing Authorization Header returns 401');
      resolve();
    });
    verifyToken(req, res, () => {
      assert.fail('Should not call next() when header is missing');
    });
  });

  // Test 2: Invalid Authorization Format (not Bearer) -> 401
  await new Promise((resolve) => {
    const req = { headers: { authorization: 'Basic 12345' } };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 401);
      assert.deepStrictEqual(finalRes.body, { error: 'Unauthorized' });
      console.log('✅ Test 2 Passed: Invalid Auth header format returns 401');
      resolve();
    });
    verifyToken(req, res, () => {
      assert.fail('Should not call next() when auth format is invalid');
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

  // Test 5: Customer Phone Verification Token signed with PHONE_VERIFICATION_SECRET
  await new Promise((resolve) => {
    const phoneTokenPayload = {
      phoneNumber: '+919876543210',
      verified: true,
      exp: Math.floor(Date.now() / 1000) + 1800
    };
    const phoneToken = jwt.sign(phoneTokenPayload, process.env.PHONE_VERIFICATION_SECRET);

    const req = { headers: { authorization: `Bearer ${phoneToken}` } };
    const res = createMockResponse(() => {
      assert.fail('Should not send error response on success');
    });
    verifyToken(req, res, () => {
      assert.ok(req.user, 'req.user should be populated from customer phone verification token');
      assert.strictEqual(req.user.phoneNumber, '+919876543210');
      assert.strictEqual(req.user.verified, true);
      console.log('✅ Test 5 Passed: Customer Phone Verification Token (PHONE_VERIFICATION_SECRET) successfully verified');
      resolve();
    });
  });

  // Test 6: Invalid / Forged JWT Token -> 401
  await new Promise((resolve) => {
    const forgedToken = jwt.sign({ phone: '9999999999' }, 'wrong_untrusted_secret');
    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 401);
      assert.deepStrictEqual(finalRes.body, { error: 'Unauthorized' });
      console.log('✅ Test 6 Passed: Forged/Untrusted token rejected with 401');
      resolve();
    });
    verifyToken(req, res, () => {
      assert.fail('Should not call next() for forged token');
    });
  });

  // Test 7: Cached Token retrieval
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
        console.log('✅ Test 7 Passed: Token caching successfully retrieves user data');
        resolve();
      });
    });
  });

  console.log('\n--- All Token Verification Middleware Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('❌ Token Verification Test Failed:', err);
  process.exit(1);
});
