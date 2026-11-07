import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const root = resolve(import.meta.dirname, '..');

// `/experimental` is outside the freeze, so only the stable entry points have a report.
export const reportedPackages = ['packages/core', 'packages/domfx', 'packages/gsap'];

export function runApiReport(packagePath, { localBuild = false, reportFolder } = {}) {
  const projectFolder = join(root, packagePath);
  const configObject = ExtractorConfig.loadFile(join(root, 'api-extractor.base.json'));
  configObject.projectFolder = projectFolder;
  if (reportFolder) {
    configObject.apiReport.reportFolder = reportFolder;
  }
  const config = ExtractorConfig.prepare({
    configObject,
    configObjectFullPath: join(projectFolder, 'api-extractor.json'),
    packageJsonFullPath: join(projectFolder, 'package.json'),
  });
  return Extractor.invoke(config, {
    localBuild,
    messageCallback(message) {
      if (message.logLevel === 'info' || message.logLevel === 'verbose') {
        message.handled = true;
      }
    },
  });
}

function main() {
  const localBuild = process.argv.includes('--update');
  let failed = false;
  for (const packagePath of reportedPackages) {
    if (localBuild) {
      mkdirSync(join(root, packagePath, 'api'), { recursive: true });
    }
    const { apiReportChanged, succeeded } = runApiReport(packagePath, { localBuild });
    if (succeeded && !(apiReportChanged && !localBuild)) {
      continue;
    }
    failed = true;
    console.error(`Public API report differs: ${packagePath}`);
  }
  if (failed) {
    console.error('Review the change, then run `pnpm api:update` and commit the report.');
    process.exitCode = 1;
    return;
  }
  console.log(localBuild ? 'API reports updated.' : 'API reports match.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
