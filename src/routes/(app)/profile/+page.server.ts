import { fail } from '@sveltejs/kit';
import { profileFormSchema } from '$lib/server/zod_schema';
import { profile } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions = {
   default: async ({ request, locals }) => {
      // 1. Get the form data
      const formData = await request.formData();
      const rawData = Object.fromEntries(formData.entries());

      // 2. Validate using Zod (It will fail if they forgot their name)
      const parsed = profileFormSchema.safeParse(rawData);
      
      if (!parsed.success) {
         return fail(400, { issues: parsed.error.flatten() });
      }

      // 3. Inject the authenticated user's ID
      const userId = locals.user.id; 

      // 4. Save to D1 Database
      await locals.db.insert(profile).values({
         ...parsed.data, 
         userId 
      });

      return { success: true };
   }
} satisfies Actions;
