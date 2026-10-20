// Planned workspaces are permitted here, not scaffolded before their tickets.
export const boundaries = {
  'packages/core': [],
  'packages/domfx': ['packages/core'],
  'packages/gsap': ['packages/core', 'packages/domfx'],
  'packages/site': ['packages/domfx'],
  'apps/docs': ['packages/core', 'packages/domfx', 'packages/gsap', 'packages/site'],
  'tests/gpu': ['packages/core', 'packages/domfx', 'packages/gsap'],
  'apps/web': ['packages/core', 'packages/domfx', 'packages/gsap', 'packages/site'],
};
