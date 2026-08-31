const verifyToken = require('./verifytoken');
const corsMiddleware = require('./cors').default || require('./cors');


const withAuth = (handler) => {
  return async (req, res) => {
    corsMiddleware(req, res, async () => {
      await verifyToken(req, res, async () => {
        await handler(req, res);
      });
    });
  };
};

module.exports = withAuth;