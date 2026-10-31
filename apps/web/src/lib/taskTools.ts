/**
 * The project tools Click can push a meeting task into.
 *
 * Each tool is connected with a personal API token the workspace brings
 * along (BYOK). The field names match the config the server expects, so the
 * same list drives the connect form and the task picker.
 */

export interface ToolField {
  name: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  required?: boolean;
  hint?: string;
}

export interface ToolSpec {
  key: string;
  name: string;
  /** Which config field names the target, shown next to the tool. */
  targetField: string;
  targetLabel: string;
  configFields: ToolField[];
  credentialFields: ToolField[];
}

export const TASK_TOOLS: ToolSpec[] = [
  {
    key: "jira",
    name: "Jira",
    targetField: "projectKey",
    targetLabel: "Project key",
    configFields: [
      {
        name: "baseUrl",
        label: "Site URL",
        placeholder: "https://acme.atlassian.net",
        required: true,
      },
      { name: "projectKey", label: "Project key", placeholder: "ENG", required: true },
      { name: "issueType", label: "Issue type", placeholder: "Task" },
    ],
    credentialFields: [
      { name: "email", label: "Account email", placeholder: "you@acme.com", required: true },
      {
        name: "apiToken",
        label: "API token",
        placeholder: "Jira API token",
        secret: true,
        required: true,
      },
    ],
  },
  {
    key: "linear",
    name: "Linear",
    targetField: "teamId",
    targetLabel: "Team id",
    configFields: [
      { name: "teamId", label: "Team id", placeholder: "2f1a…", required: true },
    ],
    credentialFields: [
      {
        name: "apiKey",
        label: "API key",
        placeholder: "lin_api_…",
        secret: true,
        required: true,
      },
    ],
  },
  {
    key: "asana",
    name: "Asana",
    targetField: "projectGid",
    targetLabel: "Project id",
    configFields: [
      { name: "projectGid", label: "Project id", placeholder: "120…", required: true },
    ],
    credentialFields: [
      {
        name: "apiToken",
        label: "Access token",
        placeholder: "Asana personal access token",
        secret: true,
        required: true,
      },
    ],
  },
  {
    key: "clickup",
    name: "ClickUp",
    targetField: "listId",
    targetLabel: "List id",
    configFields: [
      { name: "listId", label: "List id", placeholder: "90123456789", required: true },
    ],
    credentialFields: [
      {
        name: "apiToken",
        label: "API token",
        placeholder: "pk_…",
        secret: true,
        required: true,
      },
    ],
  },
  {
    key: "trello",
    name: "Trello",
    targetField: "listId",
    targetLabel: "List id",
    configFields: [
      { name: "listId", label: "List id", placeholder: "5f2a…", required: true },
    ],
    credentialFields: [
      { name: "apiKey", label: "API key", placeholder: "Trello key", secret: true, required: true },
      { name: "token", label: "Token", placeholder: "Trello token", secret: true, required: true },
    ],
  },
  {
    key: "monday",
    name: "monday.com",
    targetField: "boardId",
    targetLabel: "Board id",
    configFields: [
      { name: "boardId", label: "Board id", placeholder: "1234567890", required: true },
      { name: "groupId", label: "Group id", placeholder: "topics" },
    ],
    credentialFields: [
      {
        name: "apiToken",
        label: "API token",
        placeholder: "monday personal token",
        secret: true,
        required: true,
      },
    ],
  },
];

export function taskToolSpec(key: string): ToolSpec | undefined {
  return TASK_TOOLS.find((tool) => tool.key === key);
}

/** A short description of where the tasks land, e.g. "Project ENG". */
export function taskToolTarget(spec: ToolSpec, config: Record<string, unknown>): string {
  const value = String(config[spec.targetField] ?? "").trim();
  if (!value) return "No target set";
  return `${spec.targetLabel} ${value}`;
}
