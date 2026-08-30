import { defineConfig } from 'astro/config';
import archify from 'astro-archify';

export default defineConfig({
  integrations: [
    archify({
      quality: 'showcase'
    })
  ]
});
