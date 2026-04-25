---
name: formio-form
description: This skill provides a deep understanding on how to create a new form JSON schema definition for Form.io forms. It covers the structure of form definitions, component types, and how to use this schema when working with the MCP server tools that interact with Form.io. It should be used when creating a new Form.io form definition or when interpreting the form JSON returned by the MCP server.
license: MIT
---

# Form.io Form Schema Definitions

This document describes the Form.io form JSON schema used by the Form.io platform. Use this as a reference when working with form definitions returned by the MCP server tools (`form_list`, `form_get`) or when constructing forms programmatically.

---

## Form

The top-level object representing a form or resource in Form.io.

| Property              | Type                     | Required | Description                                                                                     |
| --------------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `_id`                 | `string`                 | No       | MongoDB ObjectId. Assigned by the server.                                                       |
| `_vid`                | `number`                 | No       | Version ID for form revisions.                                                                  |
| `title`               | `string`                 | No       | Human-readable form title (e.g., "User Registration").                                          |
| `name`                | `string`                 | No       | Machine name used for API references (e.g., "userRegister").                                    |
| `path`                | `string`                 | No       | URL path segment for the form (e.g., "user/register").                                          |
| `type`                | `FormType`               | No       | Either `"form"` or `"resource"`. Resources are reusable data models; forms collect submissions. |
| `display`             | `FormDisplay`            | No       | Rendering mode: `"form"` (single page), `"wizard"` (multi-step), or `"pdf"`.                    |
| `action`              | `string`                 | No       | URL to submit the form to. Defaults to the Form.io API.                                         |
| `tags`                | `string[]`               | No       | Arbitrary tags for categorization and filtering.                                                |
| `access`              | `Access[]`               | No       | Form-level access permissions (who can read/write the form definition).                         |
| `submissionAccess`    | `Access[]`               | No       | Submission-level access permissions (who can create/read/update/delete submissions).            |
| `fieldMatchAccess`    | `object`                 | No       | Field-level access control rules.                                                               |
| `owner`               | `string`                 | No       | Submission ID of the form owner.                                                                |
| `machineName`         | `string`                 | No       | Globally unique machine name across projects.                                                   |
| `components`          | `Component[]`            | **Yes**  | Array of form components defining the form's fields and layout.                                 |
| `settings`            | `FormSettings`           | No       | Form-level display and behavior settings.                                                       |
| `properties`          | `Record<string, string>` | No       | Custom key-value properties attached to the form.                                               |
| `project`             | `string`                 | No       | Project ID this form belongs to.                                                                |
| `revisions`           | `string`                 | No       | Revision mode: `"current"`, `"original"`, or `""`.                                              |
| `submissionRevisions` | `string`                 | No       | Whether submission revisions are enabled: `"true"` or `""`.                                     |
| `controller`          | `string`                 | No       | Custom controller logic (server-side JavaScript).                                               |
| `builder`             | `boolean`                | No       | Whether to show this form in the form builder.                                                  |
| `page`                | `number`                 | No       | Current wizard page index.                                                                      |
| `created`             | `string`                 | No       | ISO date when the form was created.                                                             |
| `modified`            | `string`                 | No       | ISO date when the form was last modified.                                                       |
| `deleted`             | `string`                 | No       | ISO date when the form was soft-deleted (null if active).                                       |

### FormType

- `"form"` — A standard form that collects submissions.
- `"resource"` — A reusable data model (like a database table) that other forms can reference.

### FormDisplay

- `"form"` — Renders all components on a single page.
- `"wizard"` — Multi-step form with navigation between pages (panels become steps).
- `"pdf"` — PDF-based form rendering.

### FormSettings

| Property                 | Type      | Description                                               |
| ------------------------ | --------- | --------------------------------------------------------- |
| `collection`             | `string`  | Custom MongoDB collection name for submissions.           |
| `condensedMode`          | `boolean` | Render in condensed/compact mode.                         |
| `disableAutocomplete`    | `boolean` | Disable browser autocomplete on all fields.               |
| `fontSize`               | `number`  | Base font size for PDF rendering.                         |
| `hideTitle`              | `boolean` | Hide the form title when rendered.                        |
| `layout`                 | `string`  | Layout template name.                                     |
| `margins`                | `string`  | Page margins for PDF rendering.                           |
| `showCheckboxBackground` | `boolean` | Show background color on checkbox components.             |
| `theme`                  | `string`  | CSS theme name to apply.                                  |
| `viewAsHtml`             | `boolean` | Render submissions as static HTML instead of form fields. |
| `viewer`                 | `string`  | Viewer type for rendering.                                |
| `wizardHeaderType`       | `string`  | Wizard header style (e.g., breadcrumb).                   |
| `pdf`                    | `object`  | PDF source configuration: `{ src: string, id: string }`.  |

### Access

Each access entry defines a permission role mapping.

| Property | Type       | Description                                                                                                                                                                         |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `string`   | Access type: `"read_all"`, `"create_own"`, `"create_all"`, `"update_own"`, `"update_all"`, `"delete_own"`, `"delete_all"`, `"self"`, `"team_read"`, `"team_write"`, `"team_admin"`. |
| `roles`  | `string[]` | Array of role IDs that have this access type.                                                                                                                                       |

---

## Components

Components are the building blocks of a form. Every component extends `BaseComponent` with type-specific properties.

### BaseComponent

All components share these base properties.

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

#### Validation (`validate` object)

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

#### Conditional Display

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

---

### Component Types

#### TextField (`type: "textfield"`)

Single-line text input.

| Property                  | Type      | Description                                    |
| ------------------------- | --------- | ---------------------------------------------- |
| `inputType`               | `string`  | HTML input type override.                      |
| `inputFormat`             | `string`  | Input format (e.g., `"plain"`, `"html"`).      |
| `inputMask`               | `string`  | Input mask pattern (e.g., `"(999) 999-9999"`). |
| `inputMasks`              | `array`   | Multiple mask options: `[{ label, mask }]`.    |
| `displayMask`             | `string`  | Display-only mask (different from input mask). |
| `spellcheck`              | `boolean` | Enable browser spellcheck.                     |
| `truncateMultipleSpaces`  | `boolean` | Collapse multiple spaces to one.               |
| `validate.minLength`      | `number`  | Minimum character length.                      |
| `validate.maxLength`      | `number`  | Maximum character length.                      |
| `validate.minWords`       | `number`  | Minimum word count.                            |
| `validate.maxWords`       | `number`  | Maximum word count.                            |
| `validate.pattern`        | `string`  | Regex pattern the value must match.            |
| `validate.patternMessage` | `string`  | Custom message when pattern fails.             |

#### TextArea (`type: "textarea"`)

Multi-line text input. Extends TextField.

| Property    | Type      | Description                                               |
| ----------- | --------- | --------------------------------------------------------- |
| `rows`      | `number`  | Number of visible text rows.                              |
| `wysiwyg`   | `boolean` | Enable WYSIWYG rich text editor.                          |
| `editor`    | `string`  | Editor type: `"ckeditor"`, `"quill"`, `"ace"`.            |
| `fixedSize` | `boolean` | Prevent resizing.                                         |
| `as`        | `string`  | Render as alternative element (e.g., `"json"`, `"html"`). |

#### Number (`type: "number"`)

Numeric input.

| Property         | Type      | Description                                  |
| ---------------- | --------- | -------------------------------------------- |
| `validate.min`   | `number`  | Minimum allowed value.                       |
| `validate.max`   | `number`  | Maximum allowed value.                       |
| `validate.step`  | `string`  | Step increment (`"any"` for no restriction). |
| `delimiter`      | `boolean` | Show thousands separator.                    |
| `requireDecimal` | `boolean` | Always show decimal point.                   |
| `inputFormat`    | `string`  | Number format.                               |

#### Password (`type: "password"`)

Password input. Same properties as TextField with masked display.

#### Email (`type: "email"`)

Email input. Extends TextField.

| Property          | Type      | Description                        |
| ----------------- | --------- | ---------------------------------- |
| `kickbox.enabled` | `boolean` | Enable Kickbox email verification. |

#### PhoneNumber (`type: "phoneNumber"`)

Phone number input. Same properties as TextField.

#### Url (`type: "url"`)

URL input. Same properties as TextField.

#### DateTime (`type: "datetime"`)

Date and/or time picker.

| Property            | Type      | Description                                                         |
| ------------------- | --------- | ------------------------------------------------------------------- |
| `format`            | `string`  | Display format (e.g., `"yyyy-MM-dd HH:mm"`).                        |
| `enableDate`        | `boolean` | Enable date selection.                                              |
| `enableTime`        | `boolean` | Enable time selection.                                              |
| `defaultDate`       | `string`  | Default date value.                                                 |
| `displayInTimezone` | `string`  | Timezone for display: `"viewer"`, `"submission"`, `"utc"`.          |
| `timezone`          | `string`  | Specific timezone identifier.                                       |
| `datePicker`        | `object`  | Date picker configuration (min/max dates, disabled weekends, etc.). |
| `timePicker`        | `object`  | Time picker configuration (hour/minute step, meridian).             |

#### Day (`type: "day"`)

Separate day/month/year inputs.

| Property          | Type      | Description                                                                                  |
| ----------------- | --------- | -------------------------------------------------------------------------------------------- |
| `fields`          | `object`  | Configuration for `day`, `month`, and `year` sub-fields (type, placeholder, required, hide). |
| `dayFirst`        | `boolean` | Show day before month.                                                                       |
| `hideInputLabels` | `boolean` | Hide the sub-field labels.                                                                   |
| `minDate`         | `string`  | Minimum allowed date.                                                                        |
| `maxDate`         | `string`  | Maximum allowed date.                                                                        |

#### Time (`type: "time"`)

Time-only input. Extends TextField.

| Property     | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `format`     | `string` | Display format (e.g., `"HH:mm"`). |
| `dataFormat` | `string` | Storage format.                   |

#### Checkbox (`type: "checkbox"`)

Single boolean checkbox.

| Property | Type     | Description             |
| -------- | -------- | ----------------------- |
| `value`  | `string` | The value when checked. |
| `name`   | `string` | Input name attribute.   |

#### Radio (`type: "radio"`)

Radio button group.

| Property               | Type      | Description                                           |
| ---------------------- | --------- | ----------------------------------------------------- |
| `values`               | `array`   | Options: `[{ label, value, shortcut? }]`.             |
| `dataSrc`              | `string`  | Data source: `"values"` (static) or `"url"` (remote). |
| `data.url`             | `string`  | URL for remote options (when `dataSrc: "url"`).       |
| `inline`               | `boolean` | Render options horizontally.                          |
| `optionsLabelPosition` | `string`  | Label position relative to radio button.              |

#### SelectBoxes (`type: "selectboxes"`)

Multiple checkbox group. Extends Radio.

| Property                    | Type                      | Description                        |
| --------------------------- | ------------------------- | ---------------------------------- |
| `defaultValue`              | `Record<string, boolean>` | Default selected state per option. |
| `validate.minSelectedCount` | `number`                  | Minimum selections required.       |
| `validate.maxSelectedCount` | `number`                  | Maximum selections allowed.        |

#### Select (`type: "select"`)

Dropdown selection.

| Property         | Type              | Description                                                           |
| ---------------- | ----------------- | --------------------------------------------------------------------- |
| `dataSrc`        | `string`          | Data source: `"values"`, `"json"`, `"url"`, `"resource"`, `"custom"`. |
| `data.values`    | `array`           | Static options: `[{ label, value }]`.                                 |
| `data.url`       | `string`          | URL for remote options.                                               |
| `data.resource`  | `string`          | Resource ID for resource-based options.                               |
| `data.json`      | `array \| string` | JSON data source.                                                     |
| `data.custom`    | `string`          | Custom JavaScript returning options.                                  |
| `valueProperty`  | `string`          | Property to use as the stored value.                                  |
| `searchEnabled`  | `boolean`         | Enable type-ahead search.                                             |
| `searchField`    | `string`          | Field to search against in remote data.                               |
| `searchDebounce` | `number`          | Debounce delay for search requests (ms).                              |
| `minSearch`      | `number`          | Minimum characters before triggering search.                          |
| `lazyLoad`       | `boolean`         | Load options on first open instead of on form load.                   |
| `filter`         | `string`          | Query filter for remote data.                                         |
| `limit`          | `number`          | Max options to load per request.                                      |
| `selectFields`   | `string`          | Fields to select from remote data.                                    |
| `sort`           | `string`          | Sort order for remote data.                                           |
| `clearOnRefresh` | `boolean`         | Clear value when dependent field changes.                             |
| `uniqueOptions`  | `boolean`         | Remove duplicate options.                                             |

#### Resource (`type: "resource"`)

Select from a Form.io resource. Extends Select.

| Property   | Type     | Description       |
| ---------- | -------- | ----------------- |
| `resource` | `string` | Resource form ID. |
| `project`  | `string` | Project ID.       |

#### Hidden (`type: "hidden"`)

Hidden input. Stores data without UI. Base properties only.

#### Button (`type: "button"`)

Action button.

| Property           | Type      | Description                                                                               |
| ------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `action`           | `string`  | Button action: `"submit"`, `"reset"`, `"event"`, `"oauth"`, `"url"`, `"saveState"`.       |
| `theme`            | `string`  | Button style: `"primary"`, `"secondary"`, `"info"`, `"success"`, `"danger"`, `"warning"`. |
| `size`             | `string`  | Size: `"sm"`, `"md"`, `"lg"`, `"xl"`, `"xxl"`.                                            |
| `block`            | `boolean` | Full-width button.                                                                        |
| `leftIcon`         | `string`  | Icon class for left icon.                                                                 |
| `rightIcon`        | `string`  | Icon class for right icon.                                                                |
| `disableOnInvalid` | `boolean` | Disable button when form is invalid.                                                      |
| `event`            | `string`  | Custom event name (when `action: "event"`).                                               |

#### Signature (`type: "signature"`)

Signature pad.

| Property          | Type     | Description                |
| ----------------- | -------- | -------------------------- |
| `footer`          | `string` | Footer text below the pad. |
| `width`           | `string` | Pad width.                 |
| `height`          | `string` | Pad height.                |
| `penColor`        | `string` | Signature pen color.       |
| `backgroundColor` | `string` | Pad background color.      |

#### File (`type: "file"`)

File upload.

| Property          | Type      | Description                                    |
| ----------------- | --------- | ---------------------------------------------- |
| `image`           | `boolean` | Restrict to image files.                       |
| `privateDownload` | `boolean` | Require authentication to download.            |
| `imageSize`       | `string`  | Max image dimensions.                          |
| `filePattern`     | `string`  | Allowed file extensions (e.g., `".pdf,.doc"`). |
| `fileMinSize`     | `string`  | Minimum file size (e.g., `"1KB"`).             |
| `fileMaxSize`     | `string`  | Maximum file size (e.g., `"10MB"`).            |
| `uploadOnly`      | `boolean` | Hide download links after upload.              |

#### Tags (`type: "tags"`)

Tag input.

| Property    | Type     | Description                                |
| ----------- | -------- | ------------------------------------------ |
| `delimeter` | `string` | Character separating tags (default `","`). |
| `storeas`   | `string` | Storage format: `"string"` or `"array"`.   |
| `maxTags`   | `number` | Maximum number of tags.                    |

#### Survey (`type: "survey"`)

Survey/matrix question grid.

| Property    | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| `questions` | `array` | Row questions: `[{ label, value, tooltip }]`.  |
| `values`    | `array` | Column answers: `[{ label, value, tooltip }]`. |

---

### Layout Components

Layout components organize fields visually. They set `input: false` and contain child components.

#### Panel (`type: "panel"`)

Collapsible section with a header. In wizard forms, each panel becomes a page/step.

| Property     | Type          | Description                         |
| ------------ | ------------- | ----------------------------------- |
| `components` | `Component[]` | Child components inside the panel.  |
| `theme`      | `string`      | Panel header color theme.           |
| `breadcrumb` | `string`      | Breadcrumb display mode in wizards. |

#### Columns (`type: "columns"`)

Multi-column layout.

| Property     | Type      | Description                                                              |
| ------------ | --------- | ------------------------------------------------------------------------ |
| `columns`    | `array`   | Column definitions: `[{ components, width, offset, push, pull, size }]`. |
| `autoAdjust` | `boolean` | Auto-adjust column widths.                                               |

#### Table (`type: "table"`)

HTML table layout.

| Property    | Type            | Description                      |
| ----------- | --------------- | -------------------------------- |
| `rows`      | `Component[][]` | 2D array of components in cells. |
| `numRows`   | `number`        | Number of rows.                  |
| `numCols`   | `number`        | Number of columns.               |
| `striped`   | `boolean`       | Striped row styling.             |
| `bordered`  | `boolean`       | Cell borders.                    |
| `hover`     | `boolean`       | Row hover highlighting.          |
| `condensed` | `boolean`       | Compact row height.              |

#### Tabs (`type: "tabs"`)

Tabbed sections.

| Property         | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| `components`     | `array`   | Tab definitions: `[{ label, key, components }]`. |
| `verticalLayout` | `boolean` | Render tabs vertically.                          |

#### FieldSet (`type: "fieldset"`)

Fieldset grouping with a legend.

| Property     | Type          | Description       |
| ------------ | ------------- | ----------------- |
| `components` | `Component[]` | Child components. |

#### Well (`type: "well"`)

Visual container with a background.

| Property     | Type          | Description       |
| ------------ | ------------- | ----------------- |
| `components` | `Component[]` | Child components. |

#### Content (`type: "content"`)

Static HTML content block.

| Property | Type     | Description             |
| -------- | -------- | ----------------------- |
| `html`   | `string` | HTML content to render. |

#### HTML Element (`type: "htmlelement"`)

Custom HTML element.

| Property  | Type     | Description                                   |
| --------- | -------- | --------------------------------------------- |
| `tag`     | `string` | HTML tag name (e.g., `"div"`, `"p"`, `"h3"`). |
| `attrs`   | `array`  | HTML attributes: `[{ attr, value }]`.         |
| `content` | `string` | Inner HTML content.                           |

---

### Data Components

Data components manage repeatable or nested data structures.

#### Container (`type: "container"`)

Groups fields under a single data key as a nested object.

| Property     | Type          | Description                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------------ |
| `components` | `Component[]` | Child components. Data is stored as `{ [key]: { child1: ..., child2: ... } }`. |

#### DataGrid (`type: "datagrid"`)

Repeatable row-based table. Each row contains the same set of fields.

| Property                    | Type          | Description                       |
| --------------------------- | ------------- | --------------------------------- |
| `components`                | `Component[]` | Components in each row (columns). |
| `disableAddingRemovingRows` | `boolean`     | Lock the number of rows.          |

#### EditGrid (`type: "editgrid"`)

Repeatable list with inline or modal editing.

| Property        | Type          | Description                                              |
| --------------- | ------------- | -------------------------------------------------------- |
| `components`    | `Component[]` | Components in each entry.                                |
| `modal`         | `boolean`     | Edit entries in a modal dialog.                          |
| `inlineEdit`    | `boolean`     | Edit entries inline without saving row by row.           |
| `openWhenEmpty` | `boolean`     | Auto-open editor when no entries exist.                  |
| `removeRow`     | `string`      | Custom remove button text.                               |
| `templates`     | `object`      | Custom Handlebars templates for header, row, and footer. |

#### DataMap (`type: "datamap"`)

Key-value pair editor. Extends DataGrid.

| Property         | Type            | Description                                |
| ---------------- | --------------- | ------------------------------------------ |
| `valueComponent` | `BaseComponent` | Component definition for the value column. |
| `keyBeforeValue` | `boolean`       | Show key column before value column.       |

#### Form (`type: "form"`)

Embeds another form.

| Property    | Type      | Description                                                    |
| ----------- | --------- | -------------------------------------------------------------- |
| `src`       | `string`  | URL of the embedded form.                                      |
| `form`      | `string`  | Form ID to embed.                                              |
| `path`      | `string`  | Form path to embed.                                            |
| `reference` | `boolean` | Store as a reference instead of embedding the submission data. |

#### Address (`type: "address"`)

Address autocomplete with manual mode fallback. Extends Container.

| Property                  | Type      | Description                                         |
| ------------------------- | --------- | --------------------------------------------------- |
| `provider`                | `string`  | Address provider (e.g., `"google"`, `"nominatim"`). |
| `providerOptions`         | `object`  | Provider-specific configuration.                    |
| `enableManualMode`        | `boolean` | Allow switching to manual address entry.            |
| `switchToManualModeLabel` | `string`  | Label for the manual mode toggle.                   |

#### DataSource (`type: "datasource"`)

Fetches external data (no UI input).

| Property             | Type      | Description                          |
| -------------------- | --------- | ------------------------------------ |
| `fetch.url`          | `string`  | URL to fetch data from.              |
| `fetch.method`       | `string`  | HTTP method.                         |
| `fetch.headers`      | `array`   | Request headers: `[{ key, value }]`. |
| `fetch.authenticate` | `boolean` | Include Form.io auth token.          |

#### Recaptcha (`type: "recaptcha"`)

Google reCAPTCHA verification. Base properties only.
