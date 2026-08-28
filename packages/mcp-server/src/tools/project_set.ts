import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readHttpUrlEnv } from '../config.js';
import { planProjectEntry } from '../project-entry-plan.js';
import {
  API_ROOT_IS_NOT_YOUR_DEPLOYMENT,
  DEPLOYMENT_IS_DERIVED,
  NOT_A_HOSTED_PROJECT,
  API_ROOT_NOT_A_PROJECT,
  ENTERPRISE_ONLY,
  HOSTED_CLOUD_DEPLOYMENT,
} from '../pair-rule.js';
import {
  BASE_URL_UNDERIVABLE,
  COMMITTED_IS_HAND_AUTHORED,
  strandedBaseUrlClause,
} from '../write-refusals.js';
import { cwdSchema } from '../project-resolver.js';
import { ProjectReport, reportProject } from '../project-report.js';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { projectMappingShape } from '../output-schemas.js';
import { local } from '../tool-annotations.js';
import {
  readProjectEntryForWrite,
  unusableRecordProjectUrl,
  writeProjectEntry,
} from '../project-map.js';
import { COMMITTED_CONFIG_FILE, findCommittedConfig } from '../committed-config.js';
import { TOOL_REMEDIES } from './project-remedies.js';

export interface ProjectSetOptions {
  cwd?: () => string;
  projectUrl?: () => string | undefined;
  /**
   * The environment's deployment, for the REPORT this tool appends when a write cannot
   * leave the directory serviceable.
   *
   * That report is the reader's, and it has to be the report the reader would actually
   * give: built from the project alone, its shadowed and unpaired lines could describe
   * the same directory differently from project_get's, which is the disagreement this
   * tool asking the reader was meant to end.
   */
  baseUrl?: () => string | undefined;
}

export function registerProjectSetTool(server: McpServer, options: ProjectSetOptions = {}) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  // The weakest source of a project, and the one this writer only READS. It is
  // consulted for a single question — does anything configure a project for this
  // directory? — because the base-URL repair deliberately arrives with no
  // projectUrl, and a launch configured purely by environment is exactly where
  // that repair is most likely to be needed: FORMIO_PROJECT_URL answers for every
  // directory and the mapping answers for none. Read tolerantly, like the base
  // URL below: an unusable value is not a project, and throwing here would fail
  // the one call that can map a usable one.
  const getEnvProjectUrl =
    options.projectUrl ??
    (() => readHttpUrlEnv({ raw: process.env.FORMIO_PROJECT_URL, name: 'FORMIO_PROJECT_URL' }));
  const getEnvBaseUrl =
    options.baseUrl ??
    (() => readHttpUrlEnv({ raw: process.env.FORMIO_BASE_URL, name: 'FORMIO_BASE_URL' }));
  server.registerTool(
    'project_set',
    {
      description: [
        'Set the active Form.io project for the given working directory by recording its URL in ~/.formio/projects.json',
        'You MUST call this tool whenever the user asks to set, change, or switch the active Form.io project — do not merely acknowledge the request in text. Persisting the choice requires the tool call.',
        "The chosen URL is persisted to ~/.formio/projects.json keyed by the cwd argument when provided (or the MCP server process cwd otherwise). Pass the `cwd` argument whenever you know the user's current working directory — the server process cwd is fixed at spawn and may not match where the user actually is.",
        'Every Form.io tool resolves its project on each call, so a mapping written here needs no restart. It takes effect only where the mapping is the record that WINS, though: under a committed formio.json the mapping is the fallback if that file goes away, and this call reports the pair that actually resolves rather than the one it recorded. Read `ok` and `projectUrl` on the result rather than assuming the write governs.',
        'You normally pass only projectUrl. The base URL — which builds the portal-login URL and keys the cached token — is derived from it — https://api.form.io for a project on a form.io host, and the parent path for a project addressed as a sub-directory — so there is nothing to supply. Pass baseUrl ONLY when the server reports that it cannot be determined, which happens for a project URL that carries no path on a customer domain: there the deployment is a sibling sub-domain and nothing in the project URL names it. Do not ask the user for a base URL before the server says it needs one.',
        `This tool writes the machine-local mapping, which is keyed by absolute path and therefore does not survive a clone. To record the target with the code instead — versioned, visible in a diff, and shared with everyone who clones the repository — write a committed ${COMMITTED_CONFIG_FILE} yourself, in the application's own folder: a JSON object holding {"projectUrl": "..."}, plus "baseUrl" only when it cannot be derived. This server reads that file and never writes it.`,
        `Resolution is by scope, narrowest first, and precedence runs: a committed ${COMMITTED_CONFIG_FILE}, then the working-directory mapping, then FORMIO_PROJECT_URL in the environment, which is the weakest of the three. So a mapping written here DOES override an environment value, and a committed file overrides both.`,
      ].join(' '),
      // Strict: an argument this tool does not take is REFUSED, not silently dropped.
      // `scope` was removed with the committed-file writer, and the previous release's
      // own documentation still names it — stripped, that call would write the
      // machine-local mapping and report success for a committed write that never
      // happened. The CLI whitelists its flags for exactly this reason.
      inputSchema: z.strictObject({
        projectUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'Full URL of the Form.io project to activate. Optional when THIS DIRECTORY\'S OWN MAPPING already holds a project: omitting it then updates that record\'s baseUrl alone, which is how the "Base URL cannot be determined" error is repaired without re-asking for a project URL. Where the project is held by another record, a baseUrl alone is refused rather than split from its project — for a committed formio.json the deployment is added to that file by hand (this server never writes one), and for FORMIO_PROJECT_URL in the environment the call must carry BOTH projectUrl and baseUrl, which records the pair here. Required when nothing configures a project at all. On the Form.io hosted cloud it is the project name as a sub-domain of form.io, e.g. https://examples.form.io — never https://api.form.io, which is the Base URL every hosted project shares. On a customer-hosted deployment it is either a sibling sub-domain of that customer’s domain, e.g. https://myproject.mysite.com, or a sub-directory of the deployment, e.g. https://forms.mysite.com/myproject — whichever that deployment uses.'
          ),
        // The SAME schema every reader validates against. A write must not accept
        // what a read cannot key on.
        cwd: cwdSchema.describe(
          "User's current working directory to key the persisted mapping against, as an absolute path. Pass whenever known (e.g. from UserPromptSubmit hook context). Falls back to the MCP server's process.cwd() when omitted, which is fixed at spawn and may not be where the user is."
        ),
        baseUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'Deployment URL for the Form.io Enterprise Server that hosts this project. It builds the portal-login URL and keys the cached token, so a wrong one fails at login rather than on the request. Usually omitted: it is derived from projectUrl wherever it can be. Supply it when the server reports that it cannot be determined — a project URL with no path on a customer domain, whose deployment is a sibling sub-domain. It MAY carry a path of its own when the deployment is mounted at a sub-path. Never pass it for a project on a form.io host: those are served by https://api.form.io and by nothing else, so any other value is refused. Persisted per-cwd alongside the project URL, and bound to the project recorded with it, so each directory can target a different deployment and no deployment answers for another project. When omitted and this call does not change the project, the base URL already mapped for this directory is kept — but a call that re-points the directory to a different project keeps nothing, because that value belonged to the project being replaced.'
          ),
      }),
      outputSchema: projectMappingShape,
      // Writes only to the local project map — no Form.io request involved.
      annotations: local('Set the active project', false),
    },
    async ({ projectUrl, cwd, baseUrl: baseUrlArg }) => {
      const entryCwd = cwd ?? getServerCwd();
      const mapped = readProjectEntryForWrite(entryCwd);
      // An entry that EXISTS and cannot be honoured is not an absent one. A record's
      // URLs are validated where that record WINS — inside the resolver — so a mapping
      // entry holding a value that is not an http(s) URL parses cleanly here and is
      // fatal there. Softened to `undefined` on this side, the plan below concluded the
      // mapping had no project and deferred to the environment, so the reader said
      // "this directory's own record is broken, replace it" while the writer said "your
      // project comes from the environment" about one state — and the URL the user
      // actually intended, readable only from that entry, was overwritten without ever
      // being shown to them.
      const unusableEntry = unusableRecordProjectUrl(mapped, entryCwd);
      // Walked ONCE. The plan needs it to decide whether a deployment-only call has a
      // project to be recorded beside, and the result message needs it to say whether
      // what was just written takes effect; two walks could disagree only if the tree
      // changed mid-call, but they also read the same file twice for one answer.
      // With onNote, so a formio.json passed over on the walk is reported here as it
      // is by project_get. Silent, a caller that ran this first saw a clean success
      // and no hint that a file they expected to govern had been skipped.
      const walkNotes: string[] = [];
      // Every refusal carries them too, not just the success paths: the note that a
      // formio.json was passed over is often the CAUSE of the refusal being read.
      // A refusal that names a directory the caller did not choose has to say so.
      // The success paths already warn; the refusals did not, so one of them told an
      // agent to record the pair under the server's own spawn directory — a write
      // that succeeds, is read by nothing, and returns the next call to this same
      // refusal. project_get answers the identical state by omitting its remedy and
      // saying to call again with the user's cwd; this is that answer, in the
      // vocabulary of a writer.
      // Which directory a refusal may tell the caller to record under. Where the
      // caller named none, this answer is about the server's own spawn directory —
      // so naming it as the place to write contradicts the warning appended below,
      // and the write it invites is one nothing later reads. project_get answers the
      // same state by omitting its remedy; this is that answer in a writer's
      // vocabulary.
      const recordUnder = cwd ? `cwd ${entryCwd}` : "cwd set to the user's own directory";
      const fallbackCwdWarning = cwd
        ? ''
        : ` Note: no cwd argument was passed, so ${entryCwd} is the MCP server's own working directory rather than the user's. Call project_set again with cwd set to the user's directory BEFORE recording anything — a record written here would not be found from theirs.`;
      // Annotated on the variable so TypeScript narrows after a call: an arrow
      // returning `never` only terminates control flow for the checker when the
      // binding itself declares that type.
      const refuse: (message: string) => never = (message) => {
        throw new Error([...walkNotes, message + fallbackCwdWarning].join('\n'));
      };
      const committed = findCommittedConfig(entryCwd, {
        onNote: (message) => walkNotes.push(message),
      });
      const plan = planProjectEntry({
        cwd: entryCwd,
        requested: { projectUrl, baseUrl: baseUrlArg },
        record: {
          projectUrl: mapped.status === 'usable' ? mapped.entry.env.FORMIO_PROJECT_URL : undefined,
          baseUrl: mapped.status === 'usable' ? mapped.entry.env.FORMIO_BASE_URL : undefined,
        },
        // Where the project lives when this mapping has none.
        elsewhere: {
          committed,
          environment: getEnvProjectUrl(),
        },
      });

      // Before any outcome that names another record: a write carrying no project URL
      // has nothing to replace this entry with, and every diagnosis downstream would be
      // about a record that does not govern.
      // Only where the mapping is the record that WOULD govern. A committed formio.json
      // outranks it, so a broken entry beneath one decides nothing — and naming the
      // mapping as "the record that governs this directory" there is the same
      // wrong-record diagnosis this guard exists to stop, one layer up. The plan's own
      // wrong-record branch answers that case, in the committed file's vocabulary.
      if (unusableEntry !== undefined && !projectUrl && !committed?.projectUrl) {
        refuse(
          `The mapping for ${entryCwd} holds an unusable value, so it is the record that governs this directory and it cannot answer with a project: ${unusableEntry} Nothing else supplies the project while that entry is on record. Call project_set again with cwd ${entryCwd} and projectUrl set to the project this directory should target, which replaces it. Add baseUrl only if the server then reports it cannot be determined.`
        );
      }

      if (plan.outcome === 'no-values') {
        refuse(
          'Pass at least one of projectUrl or baseUrl. With a project already mapped for this cwd, either one alone is a valid update.'
        );
      }
      if (plan.outcome === 'project-required') {
        refuse(
          `projectUrl is required for ${entryCwd}, which has no project mapped yet. Ask the user for their Project URL and call project_set again.`
        );
      }
      // A record holds a project and its deployment together, so the one project URL
      // that names no deployment cannot be recorded alone.
      if (plan.outcome === 'base-url-required') {
        refuse(
          `baseUrl is required alongside ${plan.projectUrl}: ${BASE_URL_UNDERIVABLE}.${strandedBaseUrlClause(plan)} Ask the user for the Base URL alone, then call project_set again with both projectUrl and baseUrl.`
        );
      }
      // The deployment goes where the project is. Writing it into the mapping while
      // the project lives elsewhere would split one configuration across two records.
      // The committed file is a record this server reads and never writes, so the
      // remedy there is the edit, named file and key.
      if (plan.outcome === 'wrong-record') {
        refuse(
          plan.record === 'committed'
            ? `${plan.projectUrl} is recorded in the committed ${COMMITTED_CONFIG_FILE} at ${plan.filePath}, not in this directory's mapping, so a baseUrl alone has no project to be recorded beside. Add "baseUrl": "<that value>" beside "projectUrl" in that file — ${COMMITTED_IS_HAND_AUTHORED}.`
            : `${plan.projectUrl} comes from FORMIO_PROJECT_URL in the environment, so a baseUrl alone has no project to be recorded beside. Call project_set again with ${recordUnder} and BOTH projectUrl ${plan.projectUrl} and that baseUrl, which records the pair in that directory's mapping.`
        );
      }

      // Not a shape this toolset serves. Refused before anything is written, because
      // the failure it prevents is a string of unexplained 404s much later.
      if (plan.outcome === 'not-a-hosted-project') {
        refuse(`${plan.url} is not a Form.io project URL. ${NOT_A_HOSTED_PROJECT}`);
      }
      if (plan.outcome === 'not-a-project-url') {
        refuse(`${plan.url} is ${API_ROOT_NOT_A_PROJECT}`);
      }
      if (plan.outcome === 'open-source-deployment') {
        refuse(`${plan.url} is both the Project URL and the Base URL. ${ENTERPRISE_ONLY}`);
      }
      if (plan.outcome === 'underivable-mismatch') {
        refuse(
          `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${DEPLOYMENT_IS_DERIVED} Call project_set again with projectUrl alone.`
        );
      }
      if (plan.outcome === 'api-root-deployment') {
        refuse(
          `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${API_ROOT_IS_NOT_YOUR_DEPLOYMENT}`
        );
      }
      if (plan.outcome === 'hosted-project-foreign-deployment') {
        refuse(
          `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${HOSTED_CLOUD_DEPLOYMENT} Call project_set again with projectUrl alone.`
        );
      }

      // The server's process cwd is fixed at spawn; for a plugin-launched server it is
      // not the user's directory. Keying there still beats refusing — some clients have
      // no cwd to pass — but the caller has to be told, or the next call that does pass
      // a cwd misses the mapping and loops.
      const serverCwdWarning = cwd
        ? ''
        : ` Warning: no cwd argument was passed, so this mapping is keyed to the MCP server's own working directory. If that is not the user's directory, call project_set again with cwd set to it.`;
      // A mapping written under a committed file naming a different project still
      // belongs on disk — it is the fallback if that file goes away — but it does not
      // take effect now.
      const committedProjectUrl = committed?.projectUrl;
      // Every committed file GOVERNS, whether or not it names the same project: it
      // supplies the pair that resolves, so a mapping written under one is a fallback
      // and not what takes effect. Turning this on the file DISAGREEING was the gap —
      // a committed file naming the same project left this false, and the deployment
      // sentence was written in the active voice about a repair that had not landed.
      const shadowed = Boolean(committedProjectUrl);
      // What RESOLVES is ASKED OF THE READER — the same reportProject that answers
      // project_get, over the state this write just produced. It is the only thing in
      // this result a caller does not already know, and the one thing this tool has no
      // business deciding for itself.
      //
      // Deciding it locally gave this writer a second, simpler model of precedence,
      // and it was wrong in two ways. It compared only the PROJECT halves, so a
      // committed file naming the same project as the write left the just-written
      // deployment reported as active while the committed record supplies none — the
      // caller is told the repair landed and the next authenticated call fails. And it
      // echoed the committed file's recorded deployment without the pair rule, so it
      // could report a pair `classifyPair` refuses while the resolver derived a
      // different one. Both vanish when the answer has one source.
      //
      // Asking the RESOLVER directly was still two answers, because the prose kept
      // quoting the plan while only the structured half asked: one result claimed a
      // Base URL was set and the other carried none, in exactly the case the
      // accompanying note was about. Everything the caller reads now comes from here.
      //
      // Called AFTER the write, so it describes the state the caller is being told
      // about. The environment is not passed a base URL because it cannot win here: a
      // project is on record for this directory either way, and the mapping and the
      // committed file both outrank it.
      const settle = (): ProjectReport => {
        // Kept apart from walkNotes so the shared ones can be dropped: this report
        // walks the tree a second time and re-emits every note the write already
        // collected, and a caller told twice that the same file was passed over reads
        // it as two files.
        const reportNotes: string[] = [];
        const keepNotes = () => {
          walkNotes.push(...reportNotes.filter((note) => !walkNotes.includes(note)));
        };
        let report: ProjectReport;
        try {
          report = reportProject({
            cwd: entryCwd,
            baseConfig: { projectUrl: getEnvProjectUrl(), baseUrl: getEnvBaseUrl() },
            remedies: TOOL_REMEDIES,
            notes: reportNotes,
            cwdWasNamed: Boolean(cwd),
          });
        } catch (error) {
          // NOT swallowed. A committed file is checked for shape where it is read and
          // for validity only where it wins precedence, so a file holding a URL the
          // pair rule refuses parses cleanly here and fails inside the resolver — and
          // that failure is the one fact the caller has to act on. Described as "what
          // was written" instead, this returned a success naming a pair the governing
          // file contradicts, and the next call failed with the reason discarded.
          keepNotes();
          refuse(error instanceof Error ? error.message : String(error));
        }
        keepNotes();
        return report;
      };
      // A committed file governs this directory whether or not it names the same project,
      // so a mapping write under one does not take effect — the pair project_get reports
      // comes from that file. Said for every such write, because a caller cannot be left
      // to discover it from a later report.
      const shadowedByCommitted = committedProjectUrl
        ? committedProjectUrl !== plan.projectUrl
          ? ` Note: the committed ${COMMITTED_CONFIG_FILE} for this directory names ${committedProjectUrl}, which outranks the mapping — that is the active project until the file changes, and what was recorded here is the fallback if it goes away.`
          : ` Note: the committed ${COMMITTED_CONFIG_FILE} governs this directory, so it supplies the pair that resolves — this mapping does not take effect while that file is there. To change what resolves, edit that file directly; this server reads a committed file and never writes one.`
        : '';

      if (plan.outcome !== 'unchanged') {
        writeProjectEntry({ cwd: entryCwd, env: plan.entry.env });
      }
      const settled = settle();

      // A record that does not take effect is described as RECORDED, never as set: the
      // mapping belongs on disk — it is the fallback if the committed file goes away —
      // but the deployment sentence used to be written in the active voice regardless,
      // so a repair that could not land was reported as landed.
      const verb = (active: string, recorded: string) => (shadowed ? recorded : active);
      // Where the write takes effect these are the same pair; where it does not, the
      // prose is about the RECORD and the structured result about what RESOLVES, and
      // the note between them says which is which.
      const written = shadowed ? plan : settled;
      const message =
        [...walkNotes, ''].join('\n').trimStart() +
        (plan.outcome === 'unchanged'
          ? `${verb('Active project is already', 'Mapping already records')} ${written.projectUrl} on ${written.baseUrl}, persisted for ${entryCwd}; no change`
          : plan.setAProject
            ? plan.previousProjectUrl
              ? `${verb('Active project set to', 'Recorded')} ${written.projectUrl} on ${written.baseUrl} (was ${plan.previousProjectUrl}; persisted for ${entryCwd})`
              : `${verb('Active project set to', 'Recorded')} ${written.projectUrl} on ${written.baseUrl}; mapping persisted for ${entryCwd}`
            : `${verb(`Base URL for ${written.projectUrl} set to ${written.baseUrl}`, `Recorded ${written.baseUrl} as the Base URL for ${written.projectUrl}`)}; persisted for ${entryCwd}`) +
        (plan.droppedBaseUrl
          ? ` Replaced ${plan.droppedBaseUrl}, which was recorded as this project's deployment and cannot serve it.`
          : '') +
        shadowedByCommitted +
        serverCwdWarning;

      // The write landed and the directory still cannot serve a call — the committed
      // file that governs it supplies no deployment, and nothing this tool can write
      // will. `ok` is what says so. Left true, this result told the caller the repair
      // landed and sent them straight to an authenticated call that fails for a reason
      // it already had in hand; raised to isError instead it would have taken the
      // resolved pair and `changed` down with it, which is the rest of the answer. So
      // the outcome stays a result, and carries the reader's own message — which names
      // the file and the key to edit — appended to what was written.
      const serviceable = settled.status === 'ok';
      const fullMessage = serviceable ? message : [message, '', settled.message].join('\n');
      return toMcpStructuredResult(
        {
          ok: serviceable,
          message: fullMessage,
          cwd: entryCwd,
          // Resolved after the write, so it describes the state being reported.
          projectUrl: settled.projectUrl,
          ...(settled.baseUrl ? { baseUrl: settled.baseUrl } : {}),
          changed: plan.outcome !== 'unchanged',
        },
        fullMessage
      );
    }
  );
}
