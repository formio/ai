# Base Component Reference

Properties shared by every component type. Load this file when setting validation, conditional display, calculated values, access rules, or any cross-cutting component behavior.

## BaseComponent

Every component extends this shape. `type`, `key`, and `input` are the only universally required fields.

| Property                 | Type                     | Required | Description                                                                                          |
| ------------------------ | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `type`                   | `string`                 | **Yes**  | Component type identifier (e.g., `"textfield"`, `"number"`, `"select"`).                             |
| `key`                    | `string`                 | **Yes**  | Unique data key within the form. Maps to the submission data path.                                   |
| `input`                  | `boolean`                | **Yes**  | Whether this component accepts user input (layout components set this to `false`).                   |
| `label`                  | `string`                 | No       | Human-readable label displayed above the field.                                                      |
| `placeholder`            | `string`                 | No       | Placeholder text shown when the field is empty.                                                      |
| `description`            | `string`                 | No       | Help text displayed below the field.                                                                 |
| `tooltip`                | `string`                 | No       | Tooltip text shown on hover.                                                                         |
| `prefix`                 | `string`                 | No       | Text or icon displayed before the input.                                                             |
| `suffix`                 | `string`                 | No       | Text or icon displayed after the input.                                                              |
| `customClass`            | `string`                 | No       | CSS class(es) added to the component wrapper.                                                        |
| `hidden`                 | `boolean`                | No       | Whether the component is initially hidden.                                                           |
| `hideLabel`              | `boolean`                | No       | Hide the label from display.                                                                         |
| `disabled`               | `boolean`                | No       | Whether the field is read-only.                                                                      |
| `autofocus`              | `boolean`                | No       | Auto-focus this field on form load.                                                                  |
| `tabindex`               | `string`                 | No       | Tab order index for keyboard navigation.                                                             |
| `tableView`              | `boolean`                | No       | Show this field in submission table/grid views.                                                      |
| `multiple`               | `boolean`                | No       | Allow multiple values (renders as an array).                                                         |
| `protected`              | `boolean`                | No       | Exclude this field's value from API responses.                                                       |
| `unique`                 | `boolean`                | No       | Enforce unique values across all submissions.                                                        |
| `persistent`             | `boolean \| string`      | No       | Whether to save to the database. `false` = ephemeral.                                                |
| `clearOnHide`            | `boolean`                | No       | Clear the field value when conditionally hidden.                                                     |
| `refreshOn`              | `string`                 | No       | Component key to watch — refresh this component's data when that key changes.                        |
| `redrawOn`               | `string`                 | No       | Component key to watch — redraw this component when that key changes.                                |
| `modalEdit`              | `boolean`                | No       | Edit this component in a modal dialog.                                                               |
| `labelPosition`          | `string`                 | No       | Label position: `"top"`, `"left-left"`, `"left-right"`, `"right-left"`, `"right-right"`, `"bottom"`. |
| `dataGridLabel`          | `boolean`                | No       | Show label when inside a DataGrid.                                                                   |
| `errorLabel`             | `string`                 | No       | Custom label used in validation error messages.                                                      |
| `defaultValue`           | `any`                    | No       | Default value when no submission data exists.                                                        |
| `customDefaultValue`     | `string`                 | No       | JavaScript or JSON Logic to compute a default value.                                                 |
| `calculateValue`         | `string`                 | No       | JavaScript or JSON Logic to compute the field value dynamically.                                     |
| `calculateServer`        | `boolean`                | No       | Run `calculateValue` on the server side.                                                             |
| `allowCalculateOverride` | `boolean`                | No       | Allow manual edits to override a calculated value.                                                   |
| `validateOn`             | `string`                 | No       | When to trigger validation: `"change"`, `"blur"`, or `"submit"`.                                     |
| `validateWhenHidden`     | `boolean`                | No       | Run validation even when the component is hidden.                                                    |
| `encrypted`              | `boolean`                | No       | Encrypt this field's value at rest.                                                                  |
| `showCharCount`          | `boolean`                | No       | Display a character counter below the field.                                                         |
| `showWordCount`          | `boolean`                | No       | Display a word counter below the field.                                                              |
| `properties`             | `Record<string, string>` | No       | Custom key-value metadata on the component.                                                          |
| `attributes`             | `Record<string, string>` | No       | Custom HTML attributes added to the input element.                                                   |
| `widget`                 | `object \| string`       | No       | Widget override configuration (e.g., calendar picker).                                               |
| `dbIndex`                | `boolean`                | No       | Create a database index on this field.                                                               |
| `logic`                  | `AdvancedLogic[]`        | No       | Advanced logic rules (event-driven actions).                                                         |
| `conditional`            | `object`                 | No       | Conditional display logic (simple, JSON Logic, or legacy).                                           |
| `customConditional`      | `string`                 | No       | Custom JavaScript for conditional visibility.                                                        |
| `overlay`                | `object`                 | No       | PDF overlay positioning: `{ style, left, top, width, height }`.                                      |
| `submissionAccess`       | `Access[]`               | No       | Field-level submission access rules.                                                                 |
| `errors`                 | `Record<string, string>` | No       | Custom error messages keyed by validation rule.                                                      |

## Validation (`validate` object)

Common validation rules available on most input components. Type-specific rules (`minLength`, `min`, `pattern`, etc.) are listed under each component in `input-components.md`.

| Property               | Type      | Description                                  |
| ---------------------- | --------- | -------------------------------------------- |
| `required`             | `boolean` | Field must have a value.                     |
| `custom`               | `string`  | Custom JavaScript validation.                |
| `customPrivate`        | `boolean` | Run custom validation server-side only.      |
| `customMessage`        | `string`  | Custom error message for failed validation.  |
| `strictDateValidation` | `boolean` | Enforce strict date parsing.                 |
| `multiple`             | `boolean` | Validate each value when `multiple` is true. |
| `unique`               | `boolean` | Value must be unique across submissions.     |
| `json`                 | `object`  | JSON Logic validation rule.                  |

## Conditional display

Three formats are supported and coexist — pick whichever fits the task. Simple conditionals are the most common for hand-written schemas; JSON Logic is the most expressive; the legacy form exists for backward compatibility with older builder output.

**Simple conditional:**

```json
{
  "show": true,
  "conjunction": "all",
  "conditions": [{ "component": "fieldKey", "operator": "isEqual", "value": "yes" }]
}
```

**JSON Logic conditional:**

```json
{
  "json": { "===": [{ "var": "data.fieldKey" }, "yes"] }
}
```

**Legacy conditional:**

```json
{
  "show": true,
  "when": "fieldKey",
  "eq": "yes"
}
```

For behavior beyond show/hide (e.g., setting values in response to events), use `logic` — an array of rules with triggers and actions. For free-form JS with access to the form context, use `customConditional`.
