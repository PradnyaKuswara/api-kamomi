/** Envelope yang sama dengan ApiResponse<T> di versi Java. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  errors: unknown;
}

export function ok<T>(message: string, data: T | null = null, code = 200): ApiResponse<T> {
  return { success: true, code, message, data, errors: null };
}

export function created<T>(message: string, data: T | null = null): ApiResponse<T> {
  return ok(message, data, 201);
}

export function fail(code: number, message: string, errors: unknown = null): ApiResponse<null> {
  return { success: false, code, message, data: null, errors };
}
