const verifyToken = require('./verifytoken');

const withAuth = (handler) => {
  return async (req, res) => {
    await verifyToken(req, res, async () => {
      await handler(req, res);
    });
  };
};

module.exports = withAuth;