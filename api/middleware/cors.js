const cors = require('cors');

const corsOptions = {
  origin: '*', // Allow all origins. Adjust this as needed for security.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);
corsMiddleware.default = corsMiddleware;

module.exports = corsMiddleware;