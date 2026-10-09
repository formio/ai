import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readHttpUrlEnv } from '../config.js';
import { planProjectEntry } from '../project-entry-plan.js';
import {
  API_ROOT_IS_NOT_YOUR_DEPLOYMENT,
  DEPLOYMENT_IS_DERIVED,
  DEPLOYMENT_ON_ANOTHER_DOMAIN,
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
import { projectCommand } from '../cli-launch.js';
import { cwdSchema } from '../project-resolver.js';
import { FORCED_PAIR_FACT, ProjectReport, reportProject } from '../project-report.js';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { projectMappingOutput } from '../output-schemas.js';
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
      // Rules a caller acts on, and nothing else: why the tool works this way is in
      // the package README ("Why project_set works this way").
      description: [
        "Set the active Form.io project for a working directory by recording its Project URL in ~/.formio/projects.json, keyed by `cwd` (omitted, the server's own spawn directory, which may not be the user's).",
        'Call it whenever the user asks to set, change, or switch the active project; acknowledging in text persists nothing.',
        `It needs no restart, and precedence runs: a committed ${COMMITTED_CONFIG_FILE}, then the working-directory mapping, then FORMIO_PROJECT_URL in the environment, the weakest — so a mapping written here DOES override the environment, and a committed file overrides both. Read \`ok\` and \`projectUrl\` on the result: they report the pair that actually resolves.`,
        'Pass projectUrl alone: the Base URL, which builds the portal-login URL and keys the cached token, is derived — https://api.form.io for a form.io host, the parent path for a sub-directory project. Pass baseUrl only after the server reports it cannot be determined (a path-less project URL on a customer domain).',
        `To record the target with the code instead, write a committed ${COMMITTED_CONFIG_FILE} yourself in the application's folder: {"projectUrl": "..."}, plus "baseUrl" only when it cannot be derived. This server reads that file and never writes it.`,
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
            "Full URL of the Form.io project: https://examples.form.io on the hosted cloud (never https://api.form.io), or https://myproject.mysite.com or https://forms.mysite.com/myproject on a customer deployment. Omit it only to add a baseUrl to THIS DIRECTORY'S OWN mapping. Where another record holds the project, a baseUrl alone is refused: add it to a committed formio.json by hand, or, for FORMIO_PROJECT_URL in the environment, pass both."
          ),
        // The SAME schema every reader validates against. A write must not accept
        // what a read cannot key on.
        cwd: cwdSchema.describe(
          "The user's working directory, absolute, that the mapping is keyed against. Omitted, the server's own spawn directory is used. Rules: project_set and the server instructions."
        ),
        baseUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'The deployment hosting the project; it builds the portal-login URL and keys the cached token. Usually omitted: it is derived from projectUrl. Pass it when the server reports it cannot be determined; it may carry a sub-path. Refused for a form.io host, which only https://api.form.io serves. Omitted, the value mapped for this directory is kept, unless the call re-points it to a different project.'
          ),
      }),
      outputSchema: projectMappingOutput,
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
          // This tool cannot force a pair — that is `project set --force`, a developer
          // at a shell — but it must not silently UNFORCE one either: an agent
          // re-stating the project it already resolved is an ordinary call, and the
          // plan keeps the override only while the pair itself is unchanged.
          forced: mapped.status === 'usable' ? mapped.entry.forced : undefined,
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
      // Unreachable while this tool takes no force argument, and ANSWERED rather than
      // left to the checker's exhaustiveness: overriding the domain rules is a
      // shell-only write — a developer taking responsibility for a pair those rules
      // cannot tell from a mistake — so the one honest answer here names that command.
      if (plan.outcome === 'force-requires-both') {
        refuse(
          `Recording a pair past the Project URL / Base URL domain rules is a shell-only write, and it takes both halves at once. Run: ${projectCommand(
            `set --force --project-url <project_url> --base-url <base_url> --cwd ${entryCwd}`
          )}`
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
      if (plan.outcome === 'unrelated-deployment') {
        refuse(
          `${plan.baseUrl} is not the deployment for ${plan.projectUrl}. ${DEPLOYMENT_ON_ANOTHER_DOMAIN}`
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
        writeProjectEntry({ cwd: entryCwd, ...plan.entry });
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
      // A forced pair is one the server's own refusals call impossible, so a result
      // that reports it bare reads as a bug — and an agent's next move is to "correct"
      // a record a developer set deliberately. Read off the READER, like the pair
      // itself: a mapping shadowed by a committed file is not what resolves, so its
      // override is not what this result is about.
      const forcedNote = settled.forced
        ? ` Forced: ${FORCED_PAIR_FACT} ${TOOL_REMEDIES.forcedPair(entryCwd)}`
        : '';
      const fullMessage = serviceable
        ? message + forcedNote
        : [message + forcedNote, '', settled.message].join('\n');
      return toMcpStructuredResult(
        {
          ok: serviceable,
          message: fullMessage,
          cwd: entryCwd,
          // Resolved after the write, so it describes the state being reported.
          projectUrl: settled.projectUrl,
          ...(settled.baseUrl ? { baseUrl: settled.baseUrl } : {}),
          ...(settled.forced ? { forced: true } : {}),
          changed: plan.outcome !== 'unchanged',
        },
        fullMessage
      );
    }
  );
}
