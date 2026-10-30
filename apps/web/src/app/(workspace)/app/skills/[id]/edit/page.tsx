"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchRecipes, fetchSkills, updateSkill, type SkillRow } from "@/lib/api";

const TRIGGERS = ["manual", "on_meeting_ready", "daily", "weekly", "monthly"];

export default function SkillEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const [skill, setSkill] = useState<SkillRow | null>(null);
  const [recipes, setRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeId, setRecipeId] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [skillResult, recipeResult] = await Promise.all([fetchSkills(), fetchRecipes()]);
    if (skillResult.data) {
      const found = skillResult.data.skills.find((item) => item.id === id);
      if (found) {
        setSkill(found);
        setRecipeId(found.recipeId);
        setTrigger(found.trigger);
        setEnabled(found.enabled);
      } else {
        setError("Skill not found.");
      }
    } else if (skillResult.error) {
      setError(skillResult.error);
    }
    if (recipeResult.data) {
      setRecipes(recipeResult.data.recipes.map((recipe) => ({ id: recipe.id, name: recipe.name })));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const result = await updateSkill(id, { recipeId, trigger, enabled });
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Skill did not save", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Skill saved" });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64" rounded="lg" />
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Skill not found"
            description={error ?? "It may have been deleted."}
            action={
              <Button size="sm" onClick={() => router.push("/app/skills")}>
                Back to skills
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text">Edit skill</h2>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/skills")}>
          Back
        </Button>
      </div>

      <Card>
        <CardHeader title="Skill" description="An automation that runs a recipe on a trigger." />
        <div className="grid gap-4 p-4">
          <Field label="Recipe" htmlFor="skill-recipe">
            <Select
              id="skill-recipe"
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
            >
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trigger" htmlFor="skill-trigger">
            <Select
              id="skill-trigger"
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
            >
              {TRIGGERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--color-accent)]"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text">Enabled</span>
              <span className="block text-xs text-text-muted">Paused skills do not run.</span>
            </span>
          </label>
        </div>
        <div className="flex justify-end border-t border-border p-4">
          <Button size="sm" loading={saving} onClick={() => void save()}>
            Save skill
          </Button>
        </div>
      </Card>
    </div>
  );
}
