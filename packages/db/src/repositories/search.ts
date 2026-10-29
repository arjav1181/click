import { sql } from "drizzle-orm";
import { withTenant, type TenantContext } from "../client";

export interface SearchHit {
  id: string;
  meetingId: string;
  meetingTitle: string;
  segmentId: string | null;
  speakerName: string | null;
  startMs: number;
  snippet: string;
  score: number;
  kind: "segment" | "note" | "meeting";
}

export async function searchKeyword(
  ctx: TenantContext,
  query: string,
  filters: { speaker?: string; from?: string; to?: string; limit?: number } = {},
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(filters.limit ?? 30, 100);

  return withTenant(ctx, async (tx) => {
    const result = await tx.execute(sql`
      with hits as (
        select
          s.id as segment_id,
          m.id as meeting_id,
          m.title as meeting_title,
          s.start_ms,
          s.text,
          sp.name as speaker_name,
          ts_rank(s.search_tsv, websearch_to_tsquery('simple', ${q})) as rank,
          similarity(s.text, ${q}) as trgm
        from transcript_segments s
        join transcripts t on t.id = s.transcript_id
        join meetings m on m.id = t.meeting_id
        left join speakers sp on sp.id = s.speaker_id
        where m.deleted_at is null
          and (
            s.text ilike ${"%" + q + "%"}
            or s.search_tsv @@ websearch_to_tsquery('simple', ${q})
          )
          ${filters.speaker ? sql`and sp.name ilike ${"%" + filters.speaker + "%"}` : sql``}
          ${filters.from ? sql`and m.started_at >= ${filters.from}::timestamptz` : sql``}
          ${filters.to ? sql`and m.started_at <= ${filters.to}::timestamptz` : sql``}
        order by rank desc, trgm desc, s.start_ms asc
        limit ${limit}
      )
      select * from hits
    `);

    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      id: `seg_${r.segment_id}`,
      meetingId: String(r.meeting_id),
      meetingTitle: String(r.meeting_title),
      segmentId: String(r.segment_id),
      speakerName: r.speaker_name ? String(r.speaker_name) : null,
      startMs: Number(r.start_ms),
      snippet: String(r.text),
      score: Number(r.rank ?? 0) + Number(r.trgm ?? 0),
      kind: "segment" as const,
    }));
  });
}

/**
 * Semantic search is optional: it needs pgvector and an embedding provider.
 * The caller checks configuration before calling; keyword search always works.
 */
export async function searchSemantic(
  ctx: TenantContext,
  queryEmbedding: number[],
  limit = 20,
): Promise<SearchHit[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  return withTenant(ctx, async (tx) => {
    const result = await tx.execute(sql`
      select s.id as segment_id, m.id as meeting_id, m.title as meeting_title,
             s.start_ms, s.text, sp.name as speaker_name,
             1 - (e.embedding <=> ${vectorLiteral}::vector) as similarity
      from embeddings e
      join transcript_segments s on s.id = e.object_id
      join transcripts t on t.id = s.transcript_id
      join meetings m on m.id = t.meeting_id
      left join speakers sp on sp.id = s.speaker_id
      where e.object_type = 'segment' and m.deleted_at is null
      order by e.embedding <=> ${vectorLiteral}::vector
      limit ${limit}
    `);
    return (result.rows as Array<Record<string, unknown>>).map((r) => ({
      id: `seg_${r.segment_id}`,
      meetingId: String(r.meeting_id),
      meetingTitle: String(r.meeting_title),
      segmentId: String(r.segment_id),
      speakerName: r.speaker_name ? String(r.speaker_name) : null,
      startMs: Number(r.start_ms),
      snippet: String(r.text),
      score: Number(r.similarity ?? 0),
      kind: "segment" as const,
    }));
  });
}
