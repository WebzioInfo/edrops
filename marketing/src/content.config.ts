import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      'Water Business Growth',
      'Water Delivery Operations',
      'Subscription Management',
      'Customer Retention',
      'Delivery Optimization',
      'Water Industry Trends',
      'Technology for Water Businesses',
    ]),
    publishDate: z.date(),
  }),
});

export const collections = { blog };
