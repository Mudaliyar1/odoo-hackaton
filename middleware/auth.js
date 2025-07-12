// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
};

// Middleware to check if user is not authenticated (for login/register pages)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/users/dashboard');
  } else {
    return next();
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    return res.status(403).render('error', {
      title: 'Access Denied',
      error: { message: 'Admin access required' }
    });
  }
};

// Middleware to check if user is not banned
const checkBanned = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.isBanned) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      return res.render('banned', {
        title: 'Account Suspended',
        message: 'Your account has been suspended. Please contact support.'
      });
    });
  } else {
    return next();
  }
};

// Middleware to set user in locals for templates
const setUserLocals = (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
  next();
};

module.exports = {
  requireAuth,
  requireGuest,
  requireAdmin,
  checkBanned,
  setUserLocals
};
