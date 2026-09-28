// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.edrops.in',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [react()],
  redirects: {
    '/features/': '/how-it-works/',
    '/features/subscription-management/': '/how-it-works/',
    '/features/recharge-management/': '/how-it-works/',
    '/features/delivery-management/': '/how-it-works/',
    '/features/customer-management/': '/how-it-works/',
    '/features/staff-management/': '/how-it-works/',
    '/features/analytics/': '/how-it-works/',
    '/features/doorstep-jar-swap/': '/how-it-works/',
    '/features/order-tracking/': '/how-it-works/',
    '/features/one-tap-reorder/': '/how-it-works/',
    '/features/bulk-orders/': '/bulk-orders/',
    '/features/membership/': '/membership/',
    '/industries/': '/bulk-orders/',
    '/industries/water-agencies/': '/bulk-orders/',
    '/industries/water-distributors/': '/bulk-orders/',
    '/industries/water-plants/': '/bulk-orders/',
    '/industries/water-subscription-companies/': '/bulk-orders/',
    '/blog/how-to-manage-water-delivery-business/': '/blog/how-to-order-water-jars-online/',
    '/blog/prepaid-wins/': '/blog/benefits-of-purified-water-jar-delivery/',
    '/blog/scaling-water-business/': '/blog/bulk-water-jar-orders-offices-cafes/',
  }
});