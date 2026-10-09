import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { registerActionCreateTool } from './action_create.js';
import { registerActionDeleteTool } from './action_delete.js';
import { registerActionGetTool } from './action_get.js';
import { registerActionListTool } from './action_list.js';
import { registerActionTypeGetTool } from './action_type_get.js';
import { registerActionTypeListTool } from './action_type_list.js';
import { registerActionUpdateTool } from './action_update.js';
import { registerFormCreateTool } from './form_create.js';
import { registerFormGetTool } from './form_get.js';
import { registerFormListTool } from './form_list.js';
import { registerFormPublishTool } from './form_publish.js';
import { registerFormRevertTool } from './form_revert.js';
import { registerFormRevisionGetTool } from './form_revision_get.js';
import { registerFormRevisionListTool } from './form_revision_list.js';
import { registerFormUpdateTool } from './form_update.js';
import { registerProjectExportTool } from './project_export.js';
import { registerProjectGetTool } from './project_get.js';
import { registerProjectImportTool } from './project_import.js';
import { registerProjectSetTool } from './project_set.js';
import { registerRoleCreateTool } from './role_create.js';
import { registerRoleListTool } from './role_list.js';
import { registerRoleUpdateTool } from './role_update.js';
import { registerServerStatusTool } from './server_status.js';

export interface RegisterAllToolsOptions {
  cwd?: () => string;
}

export function registerAllTools(
  server: McpServer,
  config: FormioConfig,
  options: RegisterAllToolsOptions = {}
) {
  // Reports the same resolution as project_get, so it takes the same cwd fallback.
  registerServerStatusTool(server, config, { cwd: options.cwd });
  registerFormCreateTool(server, config);
  registerFormGetTool(server, config);
  registerFormListTool(server, config);
  registerFormRevisionGetTool(server, config);
  registerFormRevisionListTool(server, config);
  registerFormUpdateTool(server, config);
  registerFormPublishTool(server, config);
  registerFormRevertTool(server, config);
  registerProjectExportTool(server, config);
  // Reports what the tools around it will resolve, so it takes the same config
  // and the same cwd fallback project_set writes under.
  registerProjectGetTool(server, config, { cwd: options.cwd });
  registerProjectImportTool(server, config);
  // The environment project comes from the already-validated config, not from a
  // second read of the environment: an unusable FORMIO_PROJECT_URL has to be
  // dropped once, in getConfig, or the tool that repairs a directory's mapping is
  // the one it breaks — and a tool reading process.env itself re-emits the
  // warning getConfig already made on every call, while its view of what is
  // configured drifts from the view the resolver uses on the next one.
  registerProjectSetTool(server, {
    cwd: options.cwd,
    projectUrl: () => config.projectUrl,
    baseUrl: () => config.baseUrl,
  });
  registerRoleCreateTool(server, config);
  registerRoleListTool(server, config);
  registerRoleUpdateTool(server, config);
  registerActionTypeListTool(server, config);
  registerActionTypeGetTool(server, config);
  registerActionCreateTool(server, config);
  registerActionListTool(server, config);
  registerActionGetTool(server, config);
  registerActionUpdateTool(server, config);
  registerActionDeleteTool(server, config);
}
