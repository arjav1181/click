/**
 * Task push clients.
 *
 * Click pushes a meeting task into the project tool the workspace connected.
 * Every provider is called through its official API with a personal token the
 * workspace brought along (BYOK), so no vendor app registration is needed and
 * no credentials leave the instance.
 */

export type TaskProvider = "jira" | "linear" | "asana" | "clickup" | "trello" | "monday";

export const TASK_PROVIDERS: TaskProvider[] = [
  "jira",
  "linear",
  "asana",
  "clickup",
  "trello",
  "monday",
];

export interface TaskToolConfig {
  /** Jira site URL, e.g. https://acme.atlassian.net */
  baseUrl?: string;
  /** Jira project key */
  projectKey?: string;
  /** Jira issue type name */
  issueType?: string;
  /** Linear team id */
  teamId?: string;
  /** Asana project gid */
  projectGid?: string;
  /** ClickUp or Trello list id */
  listId?: string;
  /** monday.com board id */
  boardId?: string;
  /** monday.com group id */
  groupId?: string;
  /** monday.com column values, as a JSON object */
  columnValues?: Record<string, unknown>;
}

export interface TaskToolCredentials {
  /** Personal API token (Asana, ClickUp, monday.com, Jira API token) */
  apiToken?: string;
  /** Personal API key (Linear, Trello key) */
  apiKey?: string;
  /** Trello personal token */
  token?: string;
  /** Jira account email */
  email?: string;
}

export interface PushTaskInput {
  text: string;
  assigneeName?: string | null;
  dueAt?: Date | null;
  meetingTitle?: string | null;
}

export interface PushTaskResult {
  provider: TaskProvider;
  externalId: string;
  url: string | null;
  label: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function required(value: string | undefined, message: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

/** The body every provider gets, so the task still makes sense on its own. */
export function taskDescription(task: PushTaskInput): string {
  const lines = [task.text.trim()];
  if (task.meetingTitle) lines.push(`From the meeting: ${task.meetingTitle}`);
  if (task.assigneeName) lines.push(`Owner: ${task.assigneeName}`);
  if (task.dueAt) lines.push(`Due: ${dateOnly(task.dueAt)}`);
  return lines.join("\n\n");
}

async function readError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  return detail.slice(0, 300);
}

/** Sends the request and turns a network failure into a readable message. */
async function providerFetch(
  provider: string,
  url: string | URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(
      `${provider} could not be reached: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

// --- Jira -------------------------------------------------------------------

async function pushJira(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const base = required(config.baseUrl, "The Jira site URL is missing.").replace(/\/$/, "");
  const projectKey = required(config.projectKey, "The Jira project key is missing.");
  const email = required(credentials.email, "The Jira account email is missing.");
  const token = required(credentials.apiToken, "The Jira API token is missing.");
  const issueType = (config.issueType ?? "Task").trim() || "Task";

  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });

  const response = await providerFetch("Jira", `${base}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary: task.text.trim().slice(0, 255),
        description: {
          type: "doc",
          version: 1,
          content: [paragraph(taskDescription(task))],
        },
        ...(task.dueAt ? { duedate: dateOnly(task.dueAt) } : {}),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Jira returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as { id?: string; key?: string };
  const key = body.key ?? body.id ?? "";
  return {
    provider: "jira",
    externalId: key,
    url: key ? `${base}/browse/${key}` : null,
    label: `Jira ${key}`,
  };
}

// --- Linear -----------------------------------------------------------------

async function pushLinear(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const apiKey = required(credentials.apiKey, "The Linear API key is missing.");
  const teamId = required(config.teamId, "The Linear team id is missing.");

  const response = await providerFetch("Linear", "https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // A personal Linear API key goes in the header as-is; an OAuth token
      // already carries its own "Bearer " prefix.
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query:
        "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
      variables: {
        input: {
          teamId,
          title: task.text.trim().slice(0, 255),
          description: taskDescription(task),
          ...(task.dueAt ? { dueDate: dateOnly(task.dueAt) } : {}),
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Linear returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as {
    data?: { issueCreate?: { success?: boolean; issue?: { id?: string; identifier?: string; url?: string } } };
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`Linear rejected the task: ${body.errors.map((error) => error.message).join("; ")}`);
  }
  const issue = body.data?.issueCreate?.issue;
  if (!body.data?.issueCreate?.success || !issue?.id) {
    throw new Error("Linear did not create the task.");
  }
  return {
    provider: "linear",
    externalId: issue.identifier ?? issue.id,
    url: issue.url ?? null,
    label: `Linear ${issue.identifier ?? issue.id}`,
  };
}

// --- Asana ------------------------------------------------------------------

async function pushAsana(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const token = required(credentials.apiToken, "The Asana access token is missing.");
  const projectGid = required(config.projectGid, "The Asana project id is missing.");

  const response = await providerFetch("Asana", "https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        name: task.text.trim().slice(0, 255),
        notes: taskDescription(task),
        projects: [projectGid],
        ...(task.dueAt ? { due_on: dateOnly(task.dueAt) } : {}),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Asana returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as { data?: { gid?: string; permalink_url?: string } };
  const gid = body.data?.gid ?? "";
  if (!gid) throw new Error("Asana did not return the task id.");
  return {
    provider: "asana",
    externalId: gid,
    url: body.data?.permalink_url ?? `https://app.asana.com/0/0/${gid}`,
    label: `Asana ${gid}`,
  };
}

// --- ClickUp ----------------------------------------------------------------

async function pushClickUp(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const token = required(credentials.apiToken, "The ClickUp API token is missing.");
  const listId = required(config.listId, "The ClickUp list id is missing.");

  const response = await providerFetch("ClickUp", `https://api.clickup.com/api/v2/list/${encodeURIComponent(listId)}/task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      name: task.text.trim().slice(0, 255),
      description: taskDescription(task),
      ...(task.dueAt
        ? { due_date: task.dueAt.getTime(), due_date_time: false }
        : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`ClickUp returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as { id?: string; url?: string };
  if (!body.id) throw new Error("ClickUp did not return the task id.");
  return {
    provider: "clickup",
    externalId: body.id,
    url: body.url ?? null,
    label: `ClickUp ${body.id}`,
  };
}

// --- Trello -----------------------------------------------------------------

async function pushTrello(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const apiKey = required(credentials.apiKey, "The Trello API key is missing.");
  const token = required(credentials.token, "The Trello token is missing.");
  const listId = required(config.listId, "The Trello list id is missing.");

  const url = new URL("https://api.trello.com/1/cards");
  url.searchParams.set("idList", listId);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);

  const response = await providerFetch("Trello", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: task.text.trim().slice(0, 255),
      desc: taskDescription(task),
      ...(task.dueAt ? { due: dateOnly(task.dueAt) } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Trello returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as { id?: string; shortUrl?: string; url?: string };
  if (!body.id) throw new Error("Trello did not return the card id.");
  return {
    provider: "trello",
    externalId: body.id,
    url: body.shortUrl ?? body.url ?? null,
    label: `Trello ${body.id}`,
  };
}

// --- monday.com -------------------------------------------------------------

async function pushMonday(
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  const token = required(credentials.apiToken, "The monday.com API token is missing.");
  const boardId = required(config.boardId, "The monday.com board id is missing.");

  const response = await providerFetch("monday.com", "https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      query:
        "mutation ($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) { create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) { id name url } }",
      variables: {
        boardId,
        itemName: task.text.trim().slice(0, 255),
        groupId: config.groupId?.trim() || null,
        columnValues: JSON.stringify(config.columnValues ?? {}),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`monday.com returned ${response.status}: ${await readError(response)}`);
  }
  const body = (await response.json()) as {
    data?: { create_item?: { id?: string; name?: string; url?: string } };
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`monday.com rejected the task: ${body.errors.map((error) => error.message).join("; ")}`);
  }
  const item = body.data?.create_item;
  if (!item?.id) throw new Error("monday.com did not create the item.");
  return {
    provider: "monday",
    externalId: item.id,
    url: item.url ?? null,
    label: `monday.com ${item.id}`,
  };
}

/** Pushes one task into one provider and returns the reference to keep. */
export async function pushTask(
  provider: TaskProvider,
  credentials: TaskToolCredentials,
  config: TaskToolConfig,
  task: PushTaskInput,
): Promise<PushTaskResult> {
  switch (provider) {
    case "jira":
      return pushJira(credentials, config, task);
    case "linear":
      return pushLinear(credentials, config, task);
    case "asana":
      return pushAsana(credentials, config, task);
    case "clickup":
      return pushClickUp(credentials, config, task);
    case "trello":
      return pushTrello(credentials, config, task);
    case "monday":
      return pushMonday(credentials, config, task);
  }
}
