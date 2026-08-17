// Agent Skills specification conformance rules
// (https://agentskills.io/specification).
//
// Kept as a pure function over already-parsed skill metadata so the rules can be
// exercised against synthetic inputs as well as the real library.

export interface SkillUnderTest {
  // Repo-relative path to the SKILL.md, used in failure messages.
  path: string;
  // Name of the directory holding the SKILL.md.
  directoryName: string;
  frontmatter: Record<string, string>;
  description: string;
}

export interface ConformanceIssue {
  path: string;
  rule: string;
  message: string;
}

export const DESCRIPTION_MAX_LENGTH = 1024;
export const NAME_MAX_LENGTH = 64;

// Lowercase alphanumerics and single hyphens, no leading or trailing hyphen.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// The specification's closed set. Anything else is a client-specific extension
// that other clients are free to reject.
export const ALLOWED_FRONTMATTER_KEYS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
] as const;

export function skillConformanceIssues(skill: SkillUnderTest): ConformanceIssue[] {
  const issue = (rule: string, message: string): ConformanceIssue => ({
    path: skill.path,
    rule,
    message,
  });

  const issues: ConformanceIssue[] = [];
  const name = skill.frontmatter.name;

  if (!name) {
    issues.push(issue('name.missing', 'frontmatter has no name'));
  } else {
    if (name.length > NAME_MAX_LENGTH) {
      issues.push(
        issue('name.length', `name is ${name.length} characters (max ${NAME_MAX_LENGTH})`)
      );
    }
    if (!NAME_PATTERN.test(name)) {
      issues.push(
        issue(
          'name.charset',
          `name "${name}" must be lowercase a-z, 0-9 and single hyphens, with no leading or trailing hyphen`
        )
      );
    }
    if (name !== skill.directoryName) {
      issues.push(
        issue(
          'name.directory_mismatch',
          `name "${name}" does not match its directory "${skill.directoryName}"`
        )
      );
    }
  }

  if (!skill.description.trim()) {
    issues.push(issue('description.empty', 'frontmatter has no description'));
  } else if (skill.description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push(
      issue(
        'description.budget',
        `description is ${skill.description.length} characters (max ${DESCRIPTION_MAX_LENGTH})`
      )
    );
  }

  const allowed = new Set<string>(ALLOWED_FRONTMATTER_KEYS);
  for (const key of Object.keys(skill.frontmatter)) {
    if (!allowed.has(key)) {
      issues.push(
        issue('frontmatter.unknown_key', `frontmatter key "${key}" is not in the specification`)
      );
    }
  }

  return issues;
}
