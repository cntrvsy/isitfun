import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { profileFormSchema } from '$lib/server/schemas';
import { profile } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions = {
   default: async ({ request, locals }) => {
      // 1. Get the form data
      const formData = await request.formData();
      const rawData = Object.fromEntries(formData.entries());

      // 2. Validate using Valibot
      const result = v.safeParse(profileFormSchema, rawData);
      
      if (!result.success) {
         return fail(400, { issues: v.flatten<typeof profileFormSchema>(result.issues) });
      }

      // 3. Inject the authenticated user's ID
      const userId = locals.user.id; 

      // 4. Save to D1 Database
      await locals.db.insert(profile).values({
         ...result.output, 
         userId 
      });

      return { success: true };
   }
} satisfies Actions;
