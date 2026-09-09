module.exports = {
  errorHandler: (err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  },
  notFoundHandler: (req, res) => res.status(404).json({ error: 'API route not found' })
};
