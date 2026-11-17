import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/index.js';

export async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.[process.env.COOKIE_NAME || 'fsg_admin_session'];
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await AdminUser.findById(decoded.sub).select('-passwordHash');
    if (!user || !user.active) return res.status(401).json({ message: 'Your admin session is no longer valid.' });
    req.admin = user;
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function ownerOnly(req, res, next) {
  if (!req.admin || req.admin.role !== 'owner') return res.status(403).json({ message: 'Owner permission is required.' });
  next();
}
