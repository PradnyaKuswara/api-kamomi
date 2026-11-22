import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../errors/app-error.js';
import { fail } from '../lib/api-response.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      // Format sama dengan MethodArgumentNotValidException: { field: message }
      const errors: Record<string, string> = {};
      for (const issue of err.validation) {
        const field = issue.instancePath.replace(/^\//, '').replace(/\//g, '.') || 'body';
        if (!(field in errors)) errors[field] = issue.message ?? 'invalid';
      }
      return reply.status(400).send(fail(400, 'Validation failed', errors));
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(fail(err.statusCode, err.message, err.errors));
    }
    // Drizzle membungkus error pg di `cause`. 23503 = FK masih dipakai, 23505 = duplikat.
    const pgCode = (err as { cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    if (pgCode === '23503') return reply.status(409).send(fail(409, 'Data masih digunakan oleh data lain'));
    if (pgCode === '23505') return reply.status(409).send(fail(409, 'Data sudah ada'));
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send(fail(status, (err as Error).message));
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(fail(500, 'Internal Server Error'));
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send(fail(404, 'Not Found')));
}
