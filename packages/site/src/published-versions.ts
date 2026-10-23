// Update only after release:verify:registry passes. Candidate manifests are not publication proof.
export const publishedVersions = {
  '@domfx/core': '0.1.0-alpha.0',
  '@domfx/browser': '0.1.0-alpha.0',
  '@domfx/gsap': '0.1.0-alpha.0',
} as const;

export const browserInstallCommand = `pnpm add -E @domfx/browser@${publishedVersions['@domfx/browser']}`;
