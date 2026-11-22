import { z } from 'zod';
import { emailFmt, notBlank } from '../../lib/validation.js';

const name = () => z.string().max(100, 'Name must not exceed 100 characters');
const emailMax = () => z.string().max(100, 'Email must not exceed 100 characters');
const phone = () => z.string().max(20, 'Phone number must not exceed 20 characters').nullish();

export const userCreateBody = z.object({
  name: notBlank('Name is required').pipe(name()),
  email: notBlank('Email is required').pipe(emailFmt('Email format is invalid')).pipe(emailMax()),
  password: notBlank('Password is required').pipe(z.string().min(6, 'Password must be at least 6 characters')),
  phoneNumber: phone(),
  roleName: notBlank('Role name is required'),
  isActive: z.boolean().nullish(),
});

export const userUpdateBody = z.object({
  name: name().nullish(),
  email: emailFmt('Email format is invalid').pipe(emailMax()).nullish(),
  password: z.string().min(6, 'Password must be at least 6 characters').nullish(),
  phoneNumber: phone(),
  roleName: z.string().nullish(),
  isActive: z.boolean().nullish(),
});
