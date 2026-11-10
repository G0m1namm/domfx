import { join } from 'node:path';

// Framework recipes shown on the Frameworks docs page and tested by test-recipes.mjs.
// Versions are the ones the docs state as tested.
export function recipeConsumers(root) {
  const recipes = join(root, 'apps/docs/recipes');
  const harnesses = join(root, 'scripts/fixtures/framework-recipes');
  const shared = { vite: '7.3.7', typescript: '5.9.3' };
  return [
    {
      framework: 'react',
      recipe: join(recipes, 'react'),
      harness: join(harnesses, 'react'),
      entry: 'main.tsx',
      typecheck: 'tsc',
      dependencies: { react: '19.3.1', 'react-dom': '19.3.1' },
      devDependencies: {
        ...shared,
        '@types/react': '19.3.0',
        '@types/react-dom': '19.3.0',
        '@vitejs/plugin-react': '5.2.0',
      },
    },
    {
      framework: 'vue',
      recipe: join(recipes, 'vue'),
      harness: join(harnesses, 'vue'),
      entry: 'main.ts',
      typecheck: 'vue-tsc',
      dependencies: { vue: '3.5.45' },
      devDependencies: { ...shared, '@vitejs/plugin-vue': '6.0.10', 'vue-tsc': '3.3.14' },
    },
  ];
}
