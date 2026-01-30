const router = require('express').Router();
const { authenticateToken } = require('../../utils/authMiddleware');

const {
  login,
  register,
  refreshToken,
  logout,
  profile,
} = require('./controller');

router.post('/login', login);
router.post('/register', register);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/profile', authenticateToken, profile);

module.exports = router;
