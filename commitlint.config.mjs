export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['core', 'domfx', 'lab', 'web', 'gsap', 'repo', 'deps', 'release']],
  },
};
