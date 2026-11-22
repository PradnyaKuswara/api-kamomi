import { z } from 'zod';

/** Setara @NotBlank(message=...): wajib ada dan tidak boleh hanya spasi. */
export const notBlank = (message: string) =>
  z.string({ error: message }).refine((s) => s.trim().length > 0, { error: message });

/** Setara @Email(message=...) */
export const emailFmt = (message: string) => z.string().email({ error: message });

export const idParam = z.object({ id: z.coerce.number().int().positive() });
