import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FormioConfig } from '../config.js';
import { registerActionCreateTool } from './action_create.js';
import { registerActionDeleteTool } from './action_delete.js';
import { registerActionGetTool } from './action_get.js';
import { registerActionListTool } from './action_list.js';
import { registerActionTypeGetTool } from './action_type_get.js';
import { registerActionTypesListTool } from './action_types_list.js';
import { registerActionUpdateTool } from './action_update.js';
import { registerFormCreateTool } from './form_create.js';
import { registerFormGetTool } from './form_get.js';
import { registerFormListTool } from './form_list.js';
import { registerFormRevisionGetTool } from './form_revision_get.js';
import { registerFormRevisionsListTool } from './form_revisions_list.js';
import { registerFormUpdateTool } from './form_update.js';
import { registerHelloTool } from './hello.js';
import { registerPdfUploadTool } from './pdf_upload.js';
import { registerProjectExportTool } from './project_export.js';
import { registerProjectImportTool } from './project_import.js';
import { registerProjectSetTool } from './project_set.js';
import { registerRoleCreateTool } from './role_create.js';
import { registerRoleListTool } from './role_list.js';
import { registerRoleUpdateTool } from './role_update.js';

export interface RegisterAllToolsOptions {
  cwd?: () => string;
}

export function registerAllTools(
  server: McpServer,
  config: FormioConfig,
  options: RegisterAllToolsOptions = {}
) {
  registerHelloTool(server);
  registerFormCreateTool(server, config);
  registerFormGetTool(server, config);
  registerFormListTool(server, config);
  registerFormRevisionGetTool(server, config);
  registerFormRevisionsListTool(server, config);
  registerFormUpdateTool(server, config);
  registerPdfUploadTool(server, config);
  registerProjectExportTool(server, config);
  registerProjectImportTool(server, config);
  // project_set is only useful when the SessionStart/PreToolUse hook drives
  // per-cwd project mapping — i.e. plugin context. Standalone .mcp.json users
  // bind the server to a project via FORMIO_PROJECT_URL instead, so exposing
  // project_set there just invites drift between the env and the map.
  if (process.env.FORMIO_PLUGIN_CONTEXT === '1') {
    registerProjectSetTool(server, { cwd: options.cwd });
  }
  registerRoleCreateTool(server, config);
  registerRoleListTool(server, config);
  registerRoleUpdateTool(server, config);
  registerActionTypesListTool(server, config);
  registerActionTypeGetTool(server, config);
  registerActionCreateTool(server, config);
  registerActionListTool(server, config);
  registerActionGetTool(server, config);
  registerActionUpdateTool(server, config);
  registerActionDeleteTool(server, config);
}
