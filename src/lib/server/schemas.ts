import * as v from 'valibot';
import { createInsertSchema } from 'drizzle-valibot';
import { profile } from '$lib/server/db/schema';

export const insertProfileSchema = createInsertSchema(profile, {
	firstName: (schema) => v.pipe(schema, v.minLength(2, 'Must be at least 2 characters')),
	lastName: (schema) => v.pipe(schema, v.minLength(2, 'Must be at least 2 characters')),
	organizationName: (schema) => v.optional(schema)
});

// Create a specific schema just for user-facing HTML forms!
// We omit id and userId because those shouldn't be submitted by the user.
export const profileFormSchema = v.omit(insertProfileSchema, ['id', 'userId']);
