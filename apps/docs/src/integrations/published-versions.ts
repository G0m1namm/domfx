import type { RemarkPlugin } from '@astrojs/markdown-remark';

import { browserInstallCommand, publishedVersions } from '@domfx/site/published-versions';

const replacements: Record<string, string> = {
  CORE_VERSION: publishedVersions['@domfx/core'],
  BROWSER_VERSION: publishedVersions['@domfx/browser'],
  GSAP_VERSION: publishedVersions['@domfx/gsap'],
  BROWSER_INSTALL: browserInstallCommand,
};

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

export const remarkPublishedVersions: RemarkPlugin = () => {
  function visit(node: MarkdownNode): void {
    if (['text', 'inlineCode', 'code'].includes(node.type) && node.value) {
      node.value = node.value.replace(/%DOMFX_([A-Z_]+)%/g, (token, name: string) => {
        if (!Object.hasOwn(replacements, name)) {
          throw new Error(`Unknown published-version placeholder: ${token}`);
        }
        return replacements[name];
      });
    }
    node.children?.forEach(visit);
  }

  return (tree) => visit(tree);
};
