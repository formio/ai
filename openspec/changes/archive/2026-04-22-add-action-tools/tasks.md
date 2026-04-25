## 1. action_types_list
<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing test: action_types_list tool is registered with formId parameter
- [x] 1.2 Write failing test: action_types_list sends GET to /form/{formId}/actions and returns catalog array
- [x] 1.3 Write failing test: action_types_list returns MCP error on API failure

### Green

- [x] 1.4 Implement action_types_list tool registration and handler
- [x] 1.5 Register action_types_list in registerAllTools

### Refactor

- [x] 1.6 Review implementation and refactor as needed

## 2. action_type_get
<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing test: action_type_get tool is registered with formId and actionName parameters, description instructs LLM to call before action_create
- [x] 2.2 Write failing test: action_type_get sends GET to /form/{formId}/actions/{actionName} and returns type info with settingsForm
- [x] 2.3 Write failing test: action_type_get returns available types error when action name not found (fetches catalog, lists available types in error message)
- [x] 2.4 Write failing test: action_type_get returns original error when both type fetch and catalog fetch fail

### Green

- [x] 2.5 Implement action_type_get tool with catalog-based error handling
- [x] 2.6 Register action_type_get in registerAllTools

### Refactor

- [x] 2.7 Review implementation and refactor as needed

## 3. action_create
<!-- depends_on: 2 -->

### Red

- [x] 3.1 Write failing test: action_create tool is registered with formId and action parameters, description references action_type_get
- [x] 3.2 Write failing test: action_create sends POST to /form/{formId}/action with minimum action definition (name, title, handler, method)
- [x] 3.3 Write failing test: action_create sends POST with full definition including settings, condition, and priority
- [x] 3.4 Write failing test: action_create validates action type against server catalog and returns available types on mismatch
- [x] 3.5 Write failing test: action_create returns MCP error on API failure

### Green

- [x] 3.6 Implement action_create tool with catalog validation and handler
- [x] 3.7 Register action_create in registerAllTools

### Refactor

- [x] 3.8 Review implementation and refactor as needed

## 4. action_list
<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing test: action_list tool is registered with formId parameter
- [x] 4.2 Write failing test: action_list sends GET to /form/{formId}/action and returns action instances array
- [x] 4.3 Write failing test: action_list returns MCP error on API failure

### Green

- [x] 4.4 Implement action_list tool registration and handler
- [x] 4.5 Register action_list in registerAllTools

### Refactor

- [x] 4.6 Review implementation and refactor as needed

## 5. action_get
<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing test: action_get tool is registered with formId and actionId parameters
- [x] 5.2 Write failing test: action_get sends GET to /form/{formId}/action/{actionId} and returns action document
- [x] 5.3 Write failing test: action_get returns MCP error on API failure (e.g., 404)

### Green

- [x] 5.4 Implement action_get tool registration and handler
- [x] 5.5 Register action_get in registerAllTools

### Refactor

- [x] 5.6 Review implementation and refactor as needed

## 6. action_update
<!-- depends_on: none -->

### Red

- [x] 6.1 Write failing test: action_update tool is registered with formId, actionId, and action parameters
- [x] 6.2 Write failing test: action_update sends PUT to /form/{formId}/action/{actionId} with action definition body
- [x] 6.3 Write failing test: action_update returns MCP error on API failure

### Green

- [x] 6.4 Implement action_update tool registration and handler
- [x] 6.5 Register action_update in registerAllTools

### Refactor

- [x] 6.6 Review implementation and refactor as needed

## 7. action_delete
<!-- depends_on: none -->

### Red

- [x] 7.1 Write failing test: action_delete tool is registered with formId and actionId parameters
- [x] 7.2 Write failing test: action_delete sends DELETE to /form/{formId}/action/{actionId} and returns success
- [x] 7.3 Write failing test: action_delete returns MCP error on API failure

### Green

- [x] 7.4 Implement action_delete tool registration and handler
- [x] 7.5 Register action_delete in registerAllTools

### Refactor

- [x] 7.6 Review implementation and refactor as needed
