function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.userRole === 'admin') return next();
    res.status(403).json({ success: false, message: 'Admin access required' });
}

module.exports = { requireAuth, requireAdmin };
