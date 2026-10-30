"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  useToast,
} from "@click/ui";
import { createSkill, deleteSkill, fetchRecipes, fetchSkills, type SkillRow } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SkillsPage() {
  const toast = useToast();
  const router = useRouter();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSkills();
    if (result.data) setSkills(result.data.skills);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const recipes = await fetchRecipes();
    if (!recipes.data || recipes.data.recipes.length === 0) {
      toast.push({ tone: "error", title: "Create a recipe first", description: "Skills run a recipe." });
      return;
    }
    const result = await createSkill({ recipeId: recipes.data.recipes[0].id, trigger: "manual" });
    if (result.error || !result.data) {
      toast.push({ tone: "error", title: "Skill could not be created", description: result.error ?? undefined });
      return;
    }
    router.push(`/app/skills/${result.data.id}/edit`);
  };

  const remove = async (skill: SkillRow) => {
    if (!window.confirm("Delete this skill?")) return;
    const result = await deleteSkill(skill.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Skill could not be deleted", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Skill deleted" });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Skills</h2>
          <p className="text-sm text-text-muted">
            Scheduled automations that run a recipe across meetings.
          </p>
        </div>
        <Button size="sm" onClick={() => void create()}>
          New skill
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Skills could not be loaded"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24" rounded="lg" />
          <Skeleton className="h-24" rounded="lg" />
        </div>
      ) : skills.length === 0 ? (
        <Card>
          <EmptyState
            title="No skills yet"
            description="Create a skill to automate a recipe across meetings."
            action={
              <Button size="sm" onClick={() => void create()}>
                New skill
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {skills.map((skill) => (
            <Card key={skill.id}>
              <CardHeader
                title={skill.recipeName}
                description={`${skill.trigger} · ${skill.enabled ? "enabled" : "paused"}`}
                actions={
                  <Badge tone={skill.enabled ? "success" : "neutral"}>
                    {skill.enabled ? "Active" : "Paused"}
                  </Badge>
                }
              />
              <div className="flex items-center justify-between gap-2 p-4">
                <p className="text-xs text-text-muted">
                  {skill.lastRunAt ? `Last run ${new Date(skill.lastRunAt).toLocaleString()}` : "Never run"}
                </p>
                <div className="flex items-center gap-2">
                  <Link href={`/app/skills/${skill.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <Button variant="danger" size="sm" onClick={() => void remove(skill)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
