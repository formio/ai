# @formio/ai

## 0.4.1

### Patch Changes

- ae993dc: Fixed issues with baseURL not getting set correctly.
- 4237e6c: Check cached JWT expiry locally before use. The MCP server now decodes a cached
  token's `exp` claim and clears expired tokens — both from the on-disk cache and
  the in-process cache — before attempting any request, triggering re-auth instead
  of thrashing on failing calls with a known-dead token.

## 0.4.0

### Minor Changes

- f75be94: Added authenticated route guards to the angular skill.

## 0.3.0

### Minor Changes

- 736278e: Added better authentication indication in login page. Improved formio-angular for correct Auth module use. Encourage the use of frontend-design skill when building applications.

## 0.2.0

### Minor Changes

- d98a326: Added formio-auth, formio-schema, form revision support, and many improvements to the skills.
