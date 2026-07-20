# Input Components Reference

Data-collecting components. Each extends `BaseComponent` (see `base-component.md`) — the tables below list only type-specific properties.

## TextField (`type: "textfield"`)

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

## TextArea (`type: "textarea"`)

Multi-line text input. Extends TextField.

| Property    | Type      | Description                                               |
| ----------- | --------- | --------------------------------------------------------- |
| `rows`      | `number`  | Number of visible text rows.                              |
| `wysiwyg`   | `boolean` | Enable WYSIWYG rich text editor.                          |
| `editor`    | `string`  | Editor type: `"ckeditor"`, `"quill"`, `"ace"`.            |
| `fixedSize` | `boolean` | Prevent resizing.                                         |
| `as`        | `string`  | Render as alternative element (e.g., `"json"`, `"html"`). |

## Number (`type: "number"`)

Numeric input.

| Property         | Type      | Description                                  |
| ---------------- | --------- | -------------------------------------------- |
| `validate.min`   | `number`  | Minimum allowed value.                       |
| `validate.max`   | `number`  | Maximum allowed value.                       |
| `validate.step`  | `string`  | Step increment (`"any"` for no restriction). |
| `delimiter`      | `boolean` | Show thousands separator.                    |
| `requireDecimal` | `boolean` | Always show decimal point.                   |
| `inputFormat`    | `string`  | Number format.                               |

## Password (`type: "password"`)

Password input. Same properties as TextField with masked display.

## Email (`type: "email"`)

Email input. Extends TextField.

| Property          | Type      | Description                        |
| ----------------- | --------- | ---------------------------------- |
| `kickbox.enabled` | `boolean` | Enable Kickbox email verification. |

## PhoneNumber (`type: "phoneNumber"`)

Phone number input. Same properties as TextField.

## Url (`type: "url"`)

URL input. Same properties as TextField.

## DateTime (`type: "datetime"`)

Date and/or time picker.

| Property | Type | Description |
| --- | --- | --- |
| `format` | `string` | Display format (e.g., `"yyyy-MM-dd HH:mm"`). |
| `enableDate` | `boolean` | Enable date selection. |
| `enableTime` | `boolean` | Enable time selection. |
| `defaultDate` | `string` | Default date value. |
| `displayInTimezone` | `string` | Timezone for display: `"viewer"`, `"submission"`, `"utc"`. |
| `timezone` | `string` | Specific timezone identifier. |
| `datePicker` | `object` | Date picker configuration (min/max dates, disabled weekends, etc.). |
| `timePicker` | `object` | Time picker configuration (hour/minute step, meridian). |

## Day (`type: "day"`)

Separate day/month/year inputs.

| Property | Type | Description |
| --- | --- | --- |
| `fields` | `object` | Configuration for `day`, `month`, and `year` sub-fields (type, placeholder, required, hide). |
| `dayFirst` | `boolean` | Show day before month. |
| `hideInputLabels` | `boolean` | Hide the sub-field labels. |
| `minDate` | `string` | Minimum allowed date. |
| `maxDate` | `string` | Maximum allowed date. |

## Time (`type: "time"`)

Time-only input. Extends TextField.

| Property     | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `format`     | `string` | Display format (e.g., `"HH:mm"`). |
| `dataFormat` | `string` | Storage format.                   |

## Checkbox (`type: "checkbox"`)

Single boolean checkbox.

| Property | Type     | Description             |
| -------- | -------- | ----------------------- |
| `value`  | `string` | The value when checked. |
| `name`   | `string` | Input name attribute.   |

## Radio (`type: "radio"`)

Radio button group.

| Property               | Type      | Description                                           |
| ---------------------- | --------- | ----------------------------------------------------- |
| `values`               | `array`   | Options: `[{ label, value, shortcut? }]`.             |
| `dataSrc`              | `string`  | Data source: `"values"` (static) or `"url"` (remote). |
| `data.url`             | `string`  | URL for remote options (when `dataSrc: "url"`).       |
| `inline`               | `boolean` | Render options horizontally.                          |
| `optionsLabelPosition` | `string`  | Label position relative to radio button.              |

## SelectBoxes (`type: "selectboxes"`)

Multiple checkbox group. Extends Radio.

| Property                    | Type                      | Description                        |
| --------------------------- | ------------------------- | ---------------------------------- |
| `defaultValue`              | `Record<string, boolean>` | Default selected state per option. |
| `validate.minSelectedCount` | `number`                  | Minimum selections required.       |
| `validate.maxSelectedCount` | `number`                  | Maximum selections allowed.        |

## Select (`type: "select"`)

Dropdown selection.

| Property | Type | Description |
| --- | --- | --- |
| `dataSrc` | `string` | Data source: `"values"`, `"json"`, `"url"`, `"resource"`, `"custom"`. |
| `data.values` | `array` | Static options: `[{ label, value }]`. |
| `data.url` | `string` | URL to fetch remote options from. |
| `data.resource` | `string` | Resource ID for resource-based options. |
| `data.json` | `array \| string` | JSON data source. |
| `data.custom` | `string` | Custom JavaScript returning options. |
| `valueProperty` | `string` | Property to use as the stored value. |
| `searchEnabled` | `boolean` | Enable type-ahead search. |
| `searchField` | `string` | Field to search against in remote data. |
| `searchDebounce` | `number` | Debounce delay for search requests (ms). |
| `minSearch` | `number` | Minimum characters before triggering search. |
| `lazyLoad` | `boolean` | Load options on first open instead of on form load. |
| `filter` | `string` | Query filter for remote data. |
| `limit` | `number` | Max options to load per request. |
| `selectFields` | `string` | Fields to select from remote data. |
| `sort` | `string` | Sort order for remote data. |
| `clearOnRefresh` | `boolean` | Clear value when dependent field changes. |
| `template` | `string` | HTML span with interpolated JS to set value to display for select options (when fetching from remote url). |
| `uniqueOptions` | `boolean` | Remove duplicate options. |

## Resource (`type: "resource"`)

Select from a Form.io resource. Extends Select.

| Property   | Type     | Description       |
| ---------- | -------- | ----------------- |
| `resource` | `string` | Resource form ID. |
| `project`  | `string` | Project ID.       |

## Hidden (`type: "hidden"`)

Hidden input. Stores data without UI. Base properties only.

## Button (`type: "button"`)

Action button.

| Property | Type | Description |
| --- | --- | --- |
| `action` | `string` | Button action: `"submit"`, `"reset"`, `"event"`, `"oauth"`, `"url"`, `"saveState"`. |
| `theme` | `string` | Button style: `"primary"`, `"secondary"`, `"info"`, `"success"`, `"danger"`, `"warning"`. |
| `size` | `string` | Size: `"sm"`, `"md"`, `"lg"`, `"xl"`, `"xxl"`. |
| `block` | `boolean` | Full-width button. |
| `leftIcon` | `string` | Icon class for left icon. |
| `rightIcon` | `string` | Icon class for right icon. |
| `disableOnInvalid` | `boolean` | Disable button when form is invalid. |
| `event` | `string` | Custom event name (when `action: "event"`). |

## Signature (`type: "signature"`)

Signature pad.

| Property          | Type     | Description                |
| ----------------- | -------- | -------------------------- |
| `footer`          | `string` | Footer text below the pad. |
| `width`           | `string` | Pad width.                 |
| `height`          | `string` | Pad height.                |
| `penColor`        | `string` | Signature pen color.       |
| `backgroundColor` | `string` | Pad background color.      |

## File (`type: "file"`)

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

## Tags (`type: "tags"`)

Tag input.

| Property    | Type     | Description                                |
| ----------- | -------- | ------------------------------------------ |
| `delimeter` | `string` | Character separating tags (default `","`). |
| `storeas`   | `string` | Storage format: `"string"` or `"array"`.   |
| `maxTags`   | `number` | Maximum number of tags.                    |

## Survey (`type: "survey"`)

Survey/matrix question grid.

| Property    | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| `questions` | `array` | Row questions: `[{ label, value, tooltip }]`.  |
| `values`    | `array` | Column answers: `[{ label, value, tooltip }]`. |
