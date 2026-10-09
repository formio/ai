// The tool surface 1.0 retired, as the lines of a document that still describe it.
//
// The server is the source of truth for tool names and arguments, and its own tests
// pin them. What they cannot see is the prose: a skill or README that still tells an
// agent to call `form_revisions_list`, to pass `publish: true` to `form_update`, or to
// expect a consent prompt sends that agent to a call the server now refuses — or to a
// prompt that never comes.

export interface SurfaceDocument {
  path: string;
  body: string;
}

export interface RetiredSurfaceIssue {
  path: string;
  line: number;
  rule: string;
  text: string;
}

interface RetiredSurfaceRule {
  rule: string;
  matches: (line: string) => boolean;
}

const LIST_TOOL = /\b(form_list|role_list|action_list|form_revision_list|action_type_list)\b/;
const TOOL_CONTEXT = /\btools?\b|\b(form|role|action|project|server)_[a-z_]+\b/i;

const RULES: readonly RetiredSurfaceRule[] = [
  {
    rule: 'renamed.action_types_list',
    matches: (line) => /\baction_types_list\b/.test(line),
  },
  {
    rule: 'renamed.form_revisions_list',
    matches: (line) => /\bform_revisions_list\b/.test(line),
  },
  {
    // `hello` became `server_status`. The SDK's i18n example keys a translation
    // `hello`, which is not a tool, so only a mention in a tool's company counts.
    rule: 'renamed.hello',
    matches: (line) => /`hello`/.test(line) || (/\bhello\b/.test(line) && TOOL_CONTEXT.test(line)),
  },
  {
    rule: 'form_update.publish_or_revert',
    matches: (line) => /`(publish|revert)`/.test(line) || /\b(publish|revert):\s*true\b/.test(line),
  },
  {
    // role_create takes `role: { title, … }`, as role_update does.
    rule: 'role_create.flat_fields',
    matches: (line) =>
      /\brole_create\b/.test(line) &&
      /`title`|\btitle:/.test(line) &&
      !/`role`|\brole:\s*\{|"role"\s*:/.test(line),
  },
  {
    rule: 'list.count',
    matches: (line) =>
      /`count`/.test(line) ||
      /"count"\s*:/.test(line) ||
      (LIST_TOOL.test(line) && /\bcount\b/.test(line)),
  },
  {
    // Saving without history is refused with HISTORY_NOT_ACCEPTED and retried with
    // acceptNoHistory; nothing prompts and nothing is remembered.
    rule: 'revisions.consent_prompt',
    matches: (line) =>
      /revisions-license-consent/.test(line) ||
      /\belicit/i.test(line) ||
      /\bconsent\b[^\n]*\brevision|\brevision[^\n]*\bconsent\b/i.test(line),
  },
];

export function retiredSurfaceIssues(documents: readonly SurfaceDocument[]): RetiredSurfaceIssue[] {
  return documents.flatMap((document) =>
    document.body.split('\n').flatMap((text, index) =>
      RULES.filter((rule) => rule.matches(text)).map((rule) => ({
        path: document.path,
        line: index + 1,
        rule: rule.rule,
        text: text.trim().slice(0, 160),
      }))
    )
  );
}

export function retiredSurfaceReport(issues: readonly RetiredSurfaceIssue[]): string {
  return issues
    .map((issue) => `${issue.path}:${issue.line} [${issue.rule}] ${issue.text}`)
    .join('\n');
}
