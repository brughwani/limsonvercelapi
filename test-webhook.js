const assert = require('assert');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const Module = require('module');
const path = require('path');

// Mock environment variables
process.env.verify_token = 'my_test_verify_token';
process.env.APP_SECRET = 'my_test_app_secret';

// Define mocks
const mockFirestore = {
  collection: (name) => {
    assert.strictEqual(name, 'Admin');
    return {
      add: async (data) => {
        return { id: 'mock_doc_123' };
      }
    };
  }
};

const mockFirebaseAdmin = {
  apps: { length: 1 },
  initializeApp: () => {},
  credential: {
    cert: () => {}
  },
  firestore: () => mockFirestore
};

const mockAxios = {
  post: async (url, data, config) => {
    return { data: { success: true } };
  }
};

const mockCorsMiddleware = (req, res, next) => next();
const mockVerifyToken = async (req, res, next) => {
  req.user = { name: 'Test Technician' };
  next();
};

// Overwrite Module.prototype.require to intercept calls globally
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'firebase-admin') {
    return mockFirebaseAdmin;
  }
  if (id === 'axios') {
    return mockAxios;
  }
  if (id.endsWith('middleware/cors')) {
    return { default: mockCorsMiddleware };
  }
  if (id.endsWith('middleware/verifytoken')) {
    return mockVerifyToken;
  }
  return originalRequire.apply(this, arguments);
};

// Require the hybrid handler dynamically using path.resolve
const handler = require(path.resolve(__dirname, 'api/fsaddcomplaint'));

// Helper to create mock response object
function createMockResponse(cb) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, val) {
      this.headers[name] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      cb(this);
    },
    json(body) {
      this.body = body;
      cb(this);
    }
  };
  return res;
}

// Helper to create mock request stream for POST
function createMockPostRequest(payload, headers = {}, query = {}) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = {
    'content-type': 'application/json',
    ...headers
  };
  req.query = query;
  
  process.nextTick(() => {
    req.emit('data', Buffer.from(payload, 'utf8'));
    req.emit('end');
  });

  return req;
}

async function runTests() {
  console.log('--- Starting Hybrid Webhook Routing Tests ---\n');

  // Test 1: GET with type=meta validation success
  await new Promise((resolve) => {
    const req = {
      method: 'GET',
      query: {
        type: 'meta',
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my_test_verify_token',
        'hub.challenge': 'challenge_123456'
      }
    };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 200);
      assert.strictEqual(finalRes.body, 'challenge_123456');
      console.log('✅ Test 1 Passed: GET type=meta Validation Success');
      resolve();
    });
    handler(req, res);
  });

  // Test 2: GET with type=meta validation fail (token mismatch)
  await new Promise((resolve) => {
    const req = {
      method: 'GET',
      query: {
        type: 'meta',
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'challenge_123456'
      }
    };
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 403);
      assert.deepStrictEqual(finalRes.body, { error: 'Verification failed' });
      console.log('✅ Test 2 Passed: GET type=meta Validation Rejection');
      resolve();
    });
    handler(req, res);
  });

  // Test 3: POST with type=meta Webhook success
  await new Promise((resolve) => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const hmac = crypto.createHmac('sha256', process.env.APP_SECRET);
    hmac.update(payload);
    const signature = 'sha256=' + hmac.digest('hex');

    const req = createMockPostRequest(payload, { 'x-hub-signature-256': signature }, { type: 'meta' });
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 200);
      assert.deepStrictEqual(finalRes.body, { status: 'success' });
      console.log('✅ Test 3 Passed: POST type=meta Webhook Signature Match');
      resolve();
    });
    handler(req, res);
  });

  // Test 4: POST with type=meta Webhook signature mismatch
  await new Promise((resolve) => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = 'sha256=invalidhashvalue';

    const req = createMockPostRequest(payload, { 'x-hub-signature-256': signature }, { type: 'meta' });
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 401);
      assert.deepStrictEqual(finalRes.body, { error: 'Signature verification failed' });
      console.log('✅ Test 4 Passed: POST type=meta Webhook Signature Mismatch');
      resolve();
    });
    handler(req, res);
  });

  // Test 5: POST Standard Complaint Registration (bypasses meta flow, runs auth)
  await new Promise((resolve) => {
    const complaintPayload = JSON.stringify({
      fields: {
        'Customer name': 'Alice Smith',
        'Phone': '9876543210',
        'address': '123 Tech Lane',
        'pincode': '400001',
        'city': 'Mumbai',
        'Brand': 'BrandX',
        'Category': 'Appliance',
        'Product name': 'Super Cooler',
        'Purchase date': '2026-01-01',
        'warranty expiry date': '2027-01-01',
        'Complain/Remark': 'Not cooling',
        'Request Type': 'Repair'
      }
    });

    const req = createMockPostRequest(complaintPayload, {}, { type: 'register' });
    const res = createMockResponse((finalRes) => {
      assert.strictEqual(finalRes.statusCode, 200);
      assert.strictEqual(finalRes.body.message, 'Complaint added successfully');
      assert.strictEqual(finalRes.body.id, 'mock_doc_123');
      console.log('✅ Test 5 Passed: POST Standard Complaint Registration Success');
      resolve();
    });
    handler(req, res);
  });

  console.log('\n--- All Hybrid Webhook Routing Tests Passed successfully! ---');
}

runTests().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
