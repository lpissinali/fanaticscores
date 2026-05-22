import { defineSecret } from 'firebase-functions/params';

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
export const afApiKey        = defineSecret('AF_API_KEY');
