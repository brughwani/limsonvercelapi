import cors from 'cors';

const corsOptions = {
  origin: '*', // Allow all origins. Adjust this as needed for security.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;