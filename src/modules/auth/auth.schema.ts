import { z } from 'zod';
import { emailFmt, notBlank } from '../../lib/validation.js';

const email = (max = 100) =>
  notBlank('Email is required').pipe(emailFmt('Email format is invalid')).pipe(
    z.string().max(max, `Email must not exceed ${max} characters`),
  );

export const registerBody = z.object({
  name: notBlank('Name is required').pipe(z.string().max(100, 'Name must not exceed 100 characters')),
  email: email(),
  password: notBlank('Password is required').pipe(z.string().min(6, 'Password must be at least 6 characters')),
  phoneNumber: z.string().max(20, 'Phone number must not exceed 20 characters').nullish(),
});

export const loginBody = z.object({
  email: notBlank('Email is required').pipe(emailFmt('Email format is invalid')),
  password: notBlank('Password is required'),
});

export const forgotPasswordBody = z.object({
  email: notBlank('Email is required').pipe(emailFmt('Invalid email format')),
});

export const resetPasswordBody = z.object({
  token: notBlank('Token is required'),
  newPassword: notBlank('New password is required').pipe(z.string().min(6, 'Password must be at least 6 characters')),
});
