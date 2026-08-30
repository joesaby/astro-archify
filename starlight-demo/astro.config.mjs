import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import archify from 'astro-archify';

export default defineConfig({
  integrations: [
    archify({ quality: 'showcase' }),
    starlight({
      title: 'astro-archify',
      description:
        'Starlight demo of astro-archify — Archify system diagrams from JSON IR code blocks',
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Diagrams',
          items: [
            { label: 'Welcome', slug: 'index' },
            { label: 'Architecture', slug: 'architecture' },
            { label: 'Workflow', slug: 'workflow' },
            { label: 'Sequence', slug: 'sequence' },
            { label: 'Data flow', slug: 'dataflow' },
            { label: 'Lifecycle', slug: 'lifecycle' },
          ],
        },
      ],
    }),
  ],
});
