"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@click/ui";
import {
  askChat,
  createChatThread,
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  type ChatCitation,
  type ChatMessageRow,
  type ChatThreadRow,
} from "@/lib/api";
import Link from "next/link";

export default function AskPage() {
  const toast = useToast();
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("global");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setThreadError(null);
    const result = await fetchChatThreads();
    if (result.data) setThreads(result.data.threads);
    if (result.error) setThreadError(result.error);
    setLoadingThreads(false);
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    setLoadingMessages(true);
    const result = await fetchChatThread(id);
    setLoadingMessages(false);
    if (result.data) {
      setMessages(result.data.messages);
      setScope(result.data.thread.scope);
    } else if (result.error) {
      toast.push({ tone: "error", title: "Thread could not be loaded", description: result.error });
    }
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const newThread = async () => {
    const result = await createChatThread({ scope, mode: "chat" });
    if (!result.data) {
      toast.push({ tone: "error", title: "Thread could not be created", description: result.error ?? undefined });
      return;
    }
    setThreads((prev) => [result.data!.thread, ...prev]);
    await openThread(result.data.thread.id);
  };

  const removeThread = async (id: string) => {
    const result = await deleteChatThread(id);
    if (result.error) {
      toast.push({ tone: "error", title: "Thread could not be deleted", description: result.error });
      return;
    }
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (!activeId) {
      // Spin up a thread on the fly so a first question never needs a manual
      // "new chat" click.
      const result = await createChatThread({ scope, mode: "chat", title: question.trim().slice(0, 80) });
      if (!result.data) {
        setAskError(result.error ?? "That question could not be sent.");
        return;
      }
      setThreads((prev) => [result.data!.thread, ...prev]);
      setActiveId(result.data.thread.id);
      await sendQuestion(result.data.thread.id, question.trim());
      return;
    }
    await sendQuestion(activeId, question.trim());
  };

  const sendQuestion = async (threadId: string, content: string) => {
    setAsking(true);
    setAskError(null);
    const optimistic: ChatMessageRow = {
      id: `pending-${Date.now()}`,
      role: "user",
      content,
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setQuestion("");

    const result = await askChat(threadId, content);
    setAsking(false);
    if (!result.data) {
      setAskError(result.error ?? "That question could not be answered.");
      setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
      return;
    }
    setMessages((prev) => [
      ...prev.filter((message) => message.id !== optimistic.id),
      { ...optimistic },
      result.data!.message,
    ]);
    // Refresh the thread list so the new title shows up.
    void loadThreads();
  };

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? null,
    [threads, activeId],
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Ask AI</h2>
        <p className="text-sm text-text-muted">
          Ask anything across your meetings. Every answer cites the moments it came from.
        </p>
      </div>

      {threadError ? (
        <Banner
          tone="danger"
          title="Chat threads could not be loaded"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={loadThreads}>
              Retry
            </Button>
          }
        >
          {threadError}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="grid content-start gap-3">
          <Button size="sm" onClick={() => void newThread()}>
            New chat
          </Button>
          {loadingThreads ? (
            <div className="grid gap-2">
              <Skeleton className="h-10" rounded="lg" />
              <Skeleton className="h-10" rounded="lg" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-text-muted">No chats yet. Ask a question to start one.</p>
          ) : (
            <ul className="grid gap-1">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <div
                    className={`group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                      activeId === thread.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => void openThread(thread.id)}
                    >
                      {thread.title || "Untitled chat"}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete chat"
                      className="text-xs text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void removeThread(thread.id)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <Card className="flex min-h-[60vh] flex-col">
          <CardHeader
            title={activeThread?.title || (activeId ? "Chat" : "Ask anything")}
            description={
              activeThread
                ? `${activeThread.scope} scope · ${messages.length} messages`
                : "Pick a chat on the left or ask a question below."
            }
          />
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {loadingMessages ? (
              <div className="grid gap-3">
                <Skeleton className="h-16" rounded="lg" />
                <Skeleton className="h-24" rounded="lg" />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                title="No messages yet"
                description="Ask a question about your meetings. Answers come with citations you can click."
              />
            ) : (
              <div className="grid gap-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {asking ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="size-3 animate-pulse rounded-pill bg-accent" />
                    Thinking…
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {askError ? (
            <Banner tone="danger" title="That question could not be answered" className="m-4 mb-0">
              {askError}
            </Banner>
          ) : null}

          <form className="border-t border-border p-4" onSubmit={(event) => void ask(event)}>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-44">
                  <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="scope">
                    Scope
                  </label>
                  <Select
                    id="scope"
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                  >
                    <option value="global">All meetings</option>
                    <option value="folder">Folder</option>
                    <option value="channel">Channel</option>
                    <option value="meeting">This meeting</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Your question" htmlFor="question">
                    <Textarea
                      ref={composerRef}
                      id="question"
                      rows={2}
                      value={question}
                      placeholder="What did we decide about the launch date?"
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          void ask(event as unknown as React.FormEvent);
                        }
                      }}
                    />
                  </Field>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={asking} disabled={!question.trim()}>
                  Ask
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessageRow }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-accent text-on-accent" : "bg-surface-2 text-text"
        }`}
      >
        <p className="whitespace-pre-wrap leading-6">{message.content}</p>
        {!isUser && message.citations.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((citation, index) => (
              <CitationChip key={`${citation.meetingId}-${index}`} citation={citation} />
            ))}
          </div>
        ) : null}
        {!isUser && message.model ? (
          <p className="mt-1 text-[10px] text-text-muted">{message.model}</p>
        ) : null}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: ChatCitation }) {
  return (
    <Link
      href={`/app/meetings/${citation.meetingId}`}
      className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-xs text-text-muted hover:bg-surface"
      title={citation.quote}
    >
      <span className="font-semibold">[{citation.label}]</span>
    </Link>
  );
}
