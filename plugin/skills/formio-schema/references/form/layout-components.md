# Layout Components Reference

Layout components organize fields visually. They set `input: false` and contain child components through a `components` array (or similar). They don't collect data themselves — their keys are not submitted, but the keys of their children are.

All layout components extend `BaseComponent` (see `base-component.md`).

## Panel (`type: "panel"`)

Collapsible section with a header. In a form with `display: "wizard"`, each top-level panel becomes a step/page.

| Property     | Type          | Description                         |
| ------------ | ------------- | ----------------------------------- |
| `components` | `Component[]` | Child components inside the panel.  |
| `theme`      | `string`      | Panel header color theme.           |
| `breadcrumb` | `string`      | Breadcrumb display mode in wizards. |

## Columns (`type: "columns"`)

Multi-column layout. Each column is a container of components with a width (typically a Bootstrap-style 1–12 grid unit).

| Property | Type | Description |
| --- | --- | --- |
| `columns` | `array` | Column definitions: `[{ components, width, offset, push, pull, size }]`. |
| `autoAdjust` | `boolean` | Auto-adjust column widths. |

## Table (`type: "table"`)

HTML table layout. Cells contain components.

| Property    | Type            | Description                      |
| ----------- | --------------- | -------------------------------- |
| `rows`      | `Component[][]` | 2D array of components in cells. |
| `numRows`   | `number`        | Number of rows.                  |
| `numCols`   | `number`        | Number of columns.               |
| `striped`   | `boolean`       | Striped row styling.             |
| `bordered`  | `boolean`       | Cell borders.                    |
| `hover`     | `boolean`       | Row hover highlighting.          |
| `condensed` | `boolean`       | Compact row height.              |

## Tabs (`type: "tabs"`)

Tabbed sections. Each tab is a named group of components.

| Property         | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| `components`     | `array`   | Tab definitions: `[{ label, key, components }]`. |
| `verticalLayout` | `boolean` | Render tabs vertically.                          |

## FieldSet (`type: "fieldset"`)

Fieldset grouping with a legend.

| Property     | Type          | Description       |
| ------------ | ------------- | ----------------- |
| `components` | `Component[]` | Child components. |

## Well (`type: "well"`)

Visual container with a background.

| Property     | Type          | Description       |
| ------------ | ------------- | ----------------- |
| `components` | `Component[]` | Child components. |

## Content (`type: "content"`)

Static HTML content block. No children; renders a string.

| Property | Type     | Description             |
| -------- | -------- | ----------------------- |
| `html`   | `string` | HTML content to render. |

## HTML Element (`type: "htmlelement"`)

Custom HTML element — use when `content` isn't flexible enough and you need a specific tag and attributes.

| Property  | Type     | Description                                   |
| --------- | -------- | --------------------------------------------- |
| `tag`     | `string` | HTML tag name (e.g., `"div"`, `"p"`, `"h3"`). |
| `attrs`   | `array`  | HTML attributes: `[{ attr, value }]`.         |
| `content` | `string` | Inner HTML content.                           |
