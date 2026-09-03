export interface ParentBinding {
  resource: ResourceConfig | 'currentUser';
  field: string;
  filter?: boolean;
}

export interface ResourceConfig {
  routePath: string;
  param: string;
  /** The form's `path` in template.json, verbatim. Never derived from the display name. */
  form: string;
  parents?: ParentBinding[];
}
