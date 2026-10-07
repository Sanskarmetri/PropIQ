import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'propiq-api';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), id: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: ISSUER,
  });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { issuer: ISSUER });
