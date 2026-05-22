import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SDK_CANONICAL_SDK_IMPORT,
  SDK_CANONICAL_UTILS_IMPORT,
  SDK_HOSTED_BASE_URL_LITERAL,
  SDK_HOSTED_PROJECT_URL_LITERAL,
  SDK_REQUIRED_REFERENCES,
  SDK_SAAS_BASE_URL_LITERAL,
  SDK_SAAS_PROJECT_URL_LITERAL,
  SDK_SKILL_DIR,
  SKILL_FILENAME,
  REFERENCES_DIRNAME,
  validateFormioSdkSkill,
  validateFormioSdkSkillContent,
  validateFormioSdkDescription,
  validateFormioSdkCanonicalImports,
  validateFormioSdkForbiddenImports,
  validateFormioSdkScriptTags,
  validateFormioSdkUrlConfigSkill,
  validateFormioSdkUrlConfigReference,
  validateFormioSdkReferenceLayout,
  validateFormioSdkNavigationTable,
  validateFormioSdkRenderingReference,
  validateLibrary,
} from '../skills-validator.js';

const GOOD_DESCRIPTION =
  'Source-derived skill teaching @formio/js and @formio/js/utils. Use when the user asks to call SDK methods or invoke Utils helpers. Not for: REST endpoint shape (see formio-api), building an app (see formio-application), planning resources (see formio-resource-planner), or Angular wrappers (see formio-angular).';

function navTable(): string {
  const rows = SDK_REQUIRED_REFERENCES.map((r) => `| Something | [${r}](./references/${r}) |`).join(
    '\n'
  );
  return `| Intent | Reference |\n| --- | --- |\n${rows}\n`;
}

function makeSkillSource(overrides: { description?: string; navTable?: string } = {}): string {
  const description = overrides.description ?? GOOD_DESCRIPTION;
  const nav = overrides.navTable ?? navTable();
  return `---
name: ${SDK_SKILL_DIR}
description: ${JSON.stringify(description)}
---

# Form.io SDK

## Imports

\`\`\`ts
${SDK_CANONICAL_SDK_IMPORT};
${SDK_CANONICAL_UTILS_IMPORT};
\`\`\`

## URL Configuration

### Hosted

\`\`\`ts
${SDK_CANONICAL_SDK_IMPORT};
Formio.${SDK_HOSTED_BASE_URL_LITERAL};
Formio.${SDK_HOSTED_PROJECT_URL_LITERAL};
\`\`\`

### SaaS

\`\`\`ts
${SDK_CANONICAL_SDK_IMPORT};
Formio.${SDK_SAAS_BASE_URL_LITERAL};
Formio.${SDK_SAAS_PROJECT_URL_LITERAL};
\`\`\`

## Navigation

${nav}
`;
}

function makeReferenceSource(opts: { utils?: boolean; sourcedFrom?: string } = {}): string {
  const sourcedFrom = opts.sourcedFrom ?? 'packages/core/src/sdk/Formio.ts';
  const urlConfig = opts.utils
    ? ''
    : `## URL Configuration

\`\`\`ts
${SDK_CANONICAL_SDK_IMPORT};
Formio.${SDK_HOSTED_BASE_URL_LITERAL};
Formio.${SDK_HOSTED_PROJECT_URL_LITERAL};
Formio.${SDK_SAAS_BASE_URL_LITERAL};
Formio.${SDK_SAAS_PROJECT_URL_LITERAL};
\`\`\`

`;
  const importLine = opts.utils ? SDK_CANONICAL_UTILS_IMPORT : SDK_CANONICAL_SDK_IMPORT;
  return `## Overview

Sourced from \`${sourcedFrom}\`.

## Imports

\`\`\`ts
${importLine};
\`\`\`

${urlConfig}## API

- \`thing()\` — does a thing.

## Examples

\`\`\`ts
${importLine};
\`\`\`
`;
}

function writeSdkSkill(
  root: string,
  opts: {
    skillContents?: string;
    skipSkill?: boolean;
    referenceContents?: Partial<Record<string, string>>;
    skipReferences?: string[];
  } = {}
) {
  const skillRoot = path.join(root, SDK_SKILL_DIR);
  fs.mkdirSync(path.join(skillRoot, REFERENCES_DIRNAME), { recursive: true });
  if (!opts.skipSkill) {
    fs.writeFileSync(path.join(skillRoot, SKILL_FILENAME), opts.skillContents ?? makeSkillSource());
  }
  const skipped = new Set(opts.skipReferences ?? []);
  for (const ref of SDK_REQUIRED_REFERENCES) {
    if (skipped.has(ref)) continue;
    const override = opts.referenceContents?.[ref];
    const body =
      override ??
      makeReferenceSource({
        utils: ref.startsWith('utils-'),
        sourcedFrom: ref.startsWith('utils-')
          ? 'packages/core/src/utils/utils.ts'
          : 'packages/core/src/sdk/Formio.ts',
      });
    // rendering.md requires Formio.createForm call + form.on('submit') + submission =
    const finalBody =
      ref === 'rendering.md'
        ? body +
          `\n\`\`\`ts
${SDK_CANONICAL_SDK_IMPORT};
const form = await Formio.createForm(document.getElementById('formio'), 'https://forms.mysite.com/myproject/myform');
form.on('submit', (submission) => console.log(submission));
form.submission = { data: { name: 'prefilled' } };
\`\`\`\n`
        : body;
    fs.writeFileSync(path.join(skillRoot, REFERENCES_DIRNAME, ref), finalBody);
  }
}

describe('validateFormioSdkSkill — scaffold', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-skill-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns [] when plugin/skills/formio-sdk/ is absent', () => {
    expect(validateFormioSdkSkill(tmpDir)).toEqual([]);
  });

  it('emits formio_sdk.skill_missing when skill dir exists but SKILL.md is absent', () => {
    fs.mkdirSync(path.join(tmpDir, SDK_SKILL_DIR), { recursive: true });
    const issues = validateFormioSdkSkill(tmpDir);
    expect(issues.some((i) => i.rule === 'formio_sdk.skill_missing')).toBe(true);
  });

  it('validateLibrary invokes validateFormioSdkSkill and surfaces its issues', () => {
    fs.mkdirSync(path.join(tmpDir, SDK_SKILL_DIR), { recursive: true });
    const issues = validateLibrary(tmpDir);
    expect(issues.some((i) => i.rule === 'formio_sdk.skill_missing')).toBe(true);
  });

  it('passes on a well-formed scaffolded skill', () => {
    writeSdkSkill(tmpDir);
    const issues = validateFormioSdkSkill(tmpDir);
    if (issues.length > 0) console.error(JSON.stringify(issues, null, 2));
    expect(issues).toEqual([]);
  });
});

describe('validateFormioSdkSkill — frontmatter + description clauses', () => {
  it('flags empty frontmatter as formio_sdk.frontmatter_missing', () => {
    const issues = validateFormioSdkSkillContent(
      'formio-sdk/SKILL.md',
      '# heading only, no frontmatter\n'
    );
    expect(issues.some((i) => i.rule === 'formio_sdk.frontmatter_missing')).toBe(true);
  });

  it('flags description missing "Use when the user asks to" as trigger', () => {
    const issues = validateFormioSdkDescription('SKILL.md', {
      name: SDK_SKILL_DIR,
      description:
        'Mentions @formio/js and @formio/js/utils. Not for: formio-api formio-application formio-resource-planner formio-angular',
    });
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.description_clause' && i.message.includes('trigger')
      )
    ).toBe(true);
  });

  it('flags description missing "Not for:" as negative', () => {
    const issues = validateFormioSdkDescription('SKILL.md', {
      name: SDK_SKILL_DIR,
      description: 'Mentions @formio/js and @formio/js/utils. Use when the user asks to do things.',
    });
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.description_clause' && i.message.includes('negative')
      )
    ).toBe(true);
  });

  it('flags description that omits formio-api in the Not for clause', () => {
    const issues = validateFormioSdkDescription('SKILL.md', {
      name: SDK_SKILL_DIR,
      description:
        'Mentions @formio/js and @formio/js/utils. Use when the user asks to do things. Not for: formio-application, formio-resource-planner, formio-angular.',
    });
    expect(
      issues.some(
        (i) =>
          i.rule === 'formio_sdk.description_clause' &&
          i.message.includes('negative') &&
          i.message.includes('formio-api')
      )
    ).toBe(true);
  });

  it('returns no description_clause issues for a full three-clause description', () => {
    const issues = validateFormioSdkDescription('SKILL.md', {
      name: SDK_SKILL_DIR,
      description: GOOD_DESCRIPTION,
    });
    expect(issues.filter((i) => i.rule === 'formio_sdk.description_clause')).toEqual([]);
  });
});

describe('validateFormioSdkSkill — canonical + forbidden imports + script tags', () => {
  it('emits canonical_import_missing sdk when SDK import is absent', () => {
    const source = `---
name: ${SDK_SKILL_DIR}
description: ${JSON.stringify(GOOD_DESCRIPTION)}
---

\`\`\`ts
${SDK_CANONICAL_UTILS_IMPORT};
\`\`\`
`;
    const issues = validateFormioSdkCanonicalImports('SKILL.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.canonical_import_missing' && i.message.includes('"sdk"')
      )
    ).toBe(true);
  });

  it('emits canonical_import_missing utils when Utils import is absent', () => {
    const source = `\`\`\`ts\n${SDK_CANONICAL_SDK_IMPORT};\n\`\`\`\n`;
    const issues = validateFormioSdkCanonicalImports('SKILL.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.canonical_import_missing' && i.message.includes('"utils"')
      )
    ).toBe(true);
  });

  it('flags @formio/core import inside fenced block', () => {
    const source = `\`\`\`ts\nimport { Formio } from '@formio/core';\n\`\`\`\n`;
    const issues = validateFormioSdkForbiddenImports('ref.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.forbidden_import' && i.message.includes('@formio/core')
      )
    ).toBe(true);
  });

  it('flags @formio/js/lib deep import', () => {
    const source = `\`\`\`ts\nimport x from '@formio/js/lib/Formio';\n\`\`\`\n`;
    const issues = validateFormioSdkForbiddenImports('ref.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.forbidden_import' && i.message.includes('@formio/js/lib/')
      )
    ).toBe(true);
  });

  it('flags require() of @formio/js', () => {
    const source = `\`\`\`js\nconst { Formio } = require('@formio/js');\n\`\`\`\n`;
    const issues = validateFormioSdkForbiddenImports('ref.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.forbidden_import' && i.message.includes('"@formio/js"')
      )
    ).toBe(true);
  });

  it('does not flag @formio/core mentioned in prose outside a code fence', () => {
    const source = 'The renderer extends @formio/core SDK methods.\n';
    expect(validateFormioSdkForbiddenImports('ref.md', source)).toEqual([]);
  });

  it('flags <script> tag inside a fenced code block', () => {
    const source = `\`\`\`html\n<script src="https://cdn.form.io/formiojs/formio.full.min.js"></script>\n\`\`\`\n`;
    const issues = validateFormioSdkScriptTags('ref.md', source);
    expect(issues.some((i) => i.rule === 'formio_sdk.forbidden_script_tag')).toBe(true);
  });

  it('does not flag <script> in prose outside a code fence', () => {
    const source = 'Avoid using <script> tags in your examples.\n';
    expect(validateFormioSdkScriptTags('ref.md', source)).toEqual([]);
  });
});

describe('validateFormioSdkSkill — URL configuration', () => {
  it('emits url_config_missing hosted when SKILL.md lacks Hosted block', () => {
    const source = `---\nname: ${SDK_SKILL_DIR}\ndescription: "x"\n---\nFormio.${SDK_SAAS_BASE_URL_LITERAL};Formio.${SDK_SAAS_PROJECT_URL_LITERAL};`;
    const issues = validateFormioSdkUrlConfigSkill('SKILL.md', source);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.url_config_missing' && i.message.includes('"hosted"')
      )
    ).toBe(true);
  });

  it('emits url_config_missing saas when SKILL.md lacks SaaS block', () => {
    const source = `Formio.${SDK_HOSTED_BASE_URL_LITERAL};Formio.${SDK_HOSTED_PROJECT_URL_LITERAL};`;
    const issues = validateFormioSdkUrlConfigSkill('SKILL.md', source);
    expect(
      issues.some((i) => i.rule === 'formio_sdk.url_config_missing' && i.message.includes('"saas"'))
    ).toBe(true);
  });

  it('emits url_config_missing saas for SDK reference whose section lacks the SaaS literal', () => {
    const refSource = `## Overview\n\nSourced from \`packages/core/src/sdk/Formio.ts\`.\n\n## Imports\n\n\`\`\`ts\n${SDK_CANONICAL_SDK_IMPORT};\n\`\`\`\n\n## URL Configuration\n\nFormio.${SDK_HOSTED_BASE_URL_LITERAL};\nFormio.${SDK_HOSTED_PROJECT_URL_LITERAL};\n\n## API\n\n- x\n\n## Examples\n\n- x\n`;
    const issues = validateFormioSdkUrlConfigReference('forms.md', refSource, 'forms.md');
    expect(
      issues.some((i) => i.rule === 'formio_sdk.url_config_missing' && i.message.includes('"saas"'))
    ).toBe(true);
  });

  it('utils references are exempt from URL Configuration', () => {
    const refSource = `## Overview\n\nSourced from \`packages/core/src/utils/utils.ts\`.\n\n## Imports\n\n## API\n\n## Examples\n`;
    const issues = validateFormioSdkUrlConfigReference(
      'utils-evaluator.md',
      refSource,
      'utils-evaluator.md'
    );
    expect(issues).toEqual([]);
  });
});

describe('validateFormioSdkSkill — required references + layout', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-refs-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits one formio_sdk.reference_missing per required file when references/ is empty', () => {
    fs.mkdirSync(path.join(tmpDir, SDK_SKILL_DIR, REFERENCES_DIRNAME), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, SDK_SKILL_DIR, SKILL_FILENAME), makeSkillSource());
    const issues = validateFormioSdkSkill(tmpDir);
    const missing = issues.filter((i) => i.rule === 'formio_sdk.reference_missing');
    expect(missing.length).toBe(SDK_REQUIRED_REFERENCES.length);
  });

  it('treats zero-byte references as missing', () => {
    writeSdkSkill(tmpDir);
    fs.writeFileSync(path.join(tmpDir, SDK_SKILL_DIR, REFERENCES_DIRNAME, 'forms.md'), '');
    const issues = validateFormioSdkSkill(tmpDir);
    expect(
      issues.some(
        (i) => i.rule === 'formio_sdk.reference_missing' && i.message.includes('forms.md')
      )
    ).toBe(true);
  });

  it('flags references missing ## Overview', () => {
    const source = `## Imports\n\n## URL Configuration\n\n## API\n\n## Examples\n`;
    const issues = validateFormioSdkReferenceLayout('forms.md', source, 'forms.md');
    expect(
      issues.some((i) => i.rule === 'formio_sdk.reference_layout' && i.message.includes('missing'))
    ).toBe(true);
  });

  it('flags references with Examples before API', () => {
    const source = `## Overview\n\nSourced from \`packages/core/src/sdk/Formio.ts\`.\n\n## Imports\n\n## URL Configuration\n\n## Examples\n\n## API\n`;
    const issues = validateFormioSdkReferenceLayout('forms.md', source, 'forms.md');
    expect(
      issues.some((i) => i.rule === 'formio_sdk.reference_layout' && i.message.includes('order'))
    ).toBe(true);
  });

  it('flags references whose Overview lacks Sourced from `packages/`', () => {
    const source = `## Overview\n\nNo source attribution here.\n\n## Imports\n\n## URL Configuration\n\n## API\n\n## Examples\n`;
    const issues = validateFormioSdkReferenceLayout('forms.md', source, 'forms.md');
    expect(
      issues.some(
        (i) =>
          i.rule === 'formio_sdk.reference_layout' &&
          i.message.includes('missing_source_attribution')
      )
    ).toBe(true);
  });
});

describe('validateFormioSdkSkill — navigation table', () => {
  it('flags SKILL.md without an Intent/Reference table', () => {
    const source = `---\nname: ${SDK_SKILL_DIR}\ndescription: x\n---\nno table here`;
    const issues = validateFormioSdkNavigationTable('SKILL.md', source);
    expect(issues.some((i) => i.rule === 'formio_sdk.navigation_table_missing')).toBe(true);
  });

  it('flags navigation table that omits a required reference', () => {
    const rows = SDK_REQUIRED_REFERENCES.filter((r) => r !== 'utils-jsonlogic.md')
      .map((r) => `| Something | [${r}](./references/${r}) |`)
      .join('\n');
    const source = `| Intent | Reference |\n| --- | --- |\n${rows}\n`;
    const issues = validateFormioSdkNavigationTable('SKILL.md', source);
    expect(
      issues.some(
        (i) =>
          i.rule === 'formio_sdk.navigation_table_missing' &&
          i.message.includes('utils-jsonlogic.md')
      )
    ).toBe(true);
  });
});

describe('validateFormioSdkSkill — rendering.md special rule', () => {
  it('flags rendering.md without a Formio.createForm( call', () => {
    const source = `## Overview\n\nSourced from \`packages/formio.js/src/Formio.js\`.\n\n## Imports\n\n\`\`\`ts\n${SDK_CANONICAL_SDK_IMPORT};\n\`\`\`\n\n## URL Configuration\n\nFormio.${SDK_HOSTED_BASE_URL_LITERAL};\nFormio.${SDK_HOSTED_PROJECT_URL_LITERAL};\nFormio.${SDK_SAAS_BASE_URL_LITERAL};\nFormio.${SDK_SAAS_PROJECT_URL_LITERAL};\n\n## API\n\n- x\n\n## Examples\n\n\`\`\`ts\n${SDK_CANONICAL_SDK_IMPORT};\n\`\`\`\n`;
    const issues = validateFormioSdkRenderingReference('rendering.md', source);
    expect(issues.some((i) => i.rule === 'formio_sdk.rendering_entry_missing')).toBe(true);
  });

  it('passes when rendering.md contains a Formio.createForm( call', () => {
    const source = `\`\`\`ts\n${SDK_CANONICAL_SDK_IMPORT};\nawait Formio.createForm(document.getElementById('formio'), 'https://forms.mysite.com/myproject/myform');\n\`\`\`\n`;
    expect(validateFormioSdkRenderingReference('rendering.md', source)).toEqual([]);
  });
});
