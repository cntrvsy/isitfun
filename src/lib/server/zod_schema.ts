import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { profile } from '$lib/server/db/schema';


export const insertProfileSchema = createInsertSchema(profile, {
  firstName: (schema) => schema.min(2, "Must be at least 2 characters"),
  lastName: (schema) => schema.min(2, "Must be at least 2 characters"),
  organizationName: (schema) => schema.optional(), 
});

// Create a specific schema just for user-facing HTML forms!
// We omit id and userId because those shouldn't be submitted by the user.
export const profileFormSchema = insertProfileSchema.omit({
  id: true,
  userId: true
});