## 1. Role List Tool
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: role_list tool is registered with optional `select` parameter
- [x] 1.2 Write failing test: default invocation calls GET /role with no query params and returns JSON array as MCP text
- [x] 1.3 Write failing test: custom select param is forwarded as query parameter
- [x] 1.4 Write failing test: API error returns isError response

### Green

- [x] 1.5 Implement `registerRoleListTool` in `role_list.ts` to pass all role_list tests
- [x] 1.6 Register `role_list` in `index.ts`

### Refactor

- [x] 1.7 Review implementation and refactor as needed

## 2. Role Create Tool
<!-- depends_on: none -->

### Red

- [x] 2.1 Write failing test: role_create tool is registered with title (required), description, default, and admin parameters
- [x] 2.2 Write failing test: create with title only sends POST /role with correct body and returns created role
- [x] 2.3 Write failing test: create with all fields includes all fields in request body
- [x] 2.4 Write failing test: API error returns isError response

### Green

- [x] 2.5 Implement `registerRoleCreateTool` in `role_create.ts` to pass all role_create tests
- [x] 2.6 Register `role_create` in `index.ts`

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. Role Update Tool
<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing test: role_update tool is registered with required `roleId` and `role` object parameters
- [x] 3.2 Write failing test: invalid roleId returns isError response with format message
- [x] 3.3 Write failing test: valid roleId sends PUT /role/:roleId with role body and returns updated role
- [x] 3.4 Write failing test: API error returns isError response

### Green

- [x] 3.5 Implement `registerRoleUpdateTool` in `role_update.ts` to pass all role_update tests
- [x] 3.6 Register `role_update` in `index.ts`

### Refactor

- [x] 3.7 Review implementation and refactor as needed

## 4. Update Project Roles Skill
<!-- depends_on: 1, 2, 3 -->

### Red

- [x] 4.1 Write failing test: project-roles skill MCP Tool Preference section references role_list, role_create, and role_update tools

### Green

- [x] 4.2 Update `formio-api/references/project-roles.md` MCP Tool Preference section to reference the three role tools

### Refactor

- [x] 4.3 Review implementation and refactor as needed
