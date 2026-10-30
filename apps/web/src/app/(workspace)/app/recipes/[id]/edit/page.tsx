"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
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
import { fetchRecipe, updateRecipe, type RecipeRow } from "@/lib/api";

export default function RecipeEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const [recipe, setRecipe] = useState<RecipeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<"single" | "multi">("single");
  const [visibility, setVisibility] = useState<"private" | "workspace" | "link">("private");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchRecipe(id);
    if (result.data) {
      setRecipe(result.data.recipe);
      setName(result.data.recipe.name);
      setPrompt(result.data.recipe.prompt);
      setScope(result.data.recipe.scope);
      setVisibility(result.data.recipe.visibility);
      setModel(result.data.recipe.model ?? "");
    }
    if (result.error) setError(result.error);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const result = await updateRecipe(id, {
      name: name.trim(),
      prompt: prompt.trim(),
      scope,
      visibility,
      model: model.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Recipe did not save", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Recipe saved" });
    if (result.data) setRecipe(result.data.recipe);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64" rounded="lg" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Recipe not found"
            description={error ?? "It may have been deleted."}
            action={
              <Button size="sm" onClick={() => router.push("/app/recipes")}>
                Back to recipes
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
        <h2 className="text-xl font-semibold text-text">Edit recipe</h2>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/recipes")}>
          Back
        </Button>
      </div>

      <Card>
        <CardHeader title="Recipe" description="A saved prompt you can run across meetings." />
        <div className="grid gap-4 p-4">
          <Field label="Name" htmlFor="recipe-name">
            <Input id="recipe-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Prompt" htmlFor="recipe-prompt" hint="The instruction the AI runs. Use {{transcript}} for the meeting text.">
            <Textarea
              id="recipe-prompt"
              rows={8}
              value={prompt}
              maxLength={8000}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scope" htmlFor="recipe-scope">
              <Select id="recipe-scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
                <option value="single">Single meeting</option>
                <option value="multi">Multiple meetings</option>
              </Select>
            </Field>
            <Field label="Visibility" htmlFor="recipe-visibility">
              <Select
                id="recipe-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as typeof visibility)}
              >
                <option value="private">Private</option>
                <option value="workspace">Workspace</option>
                <option value="link">Link</option>
              </Select>
            </Field>
          </div>
          <Field label="Model (optional)" htmlFor="recipe-model">
            <Input
              id="recipe-model"
              value={model}
              maxLength={120}
              placeholder="Leave blank for the workspace default"
              onChange={(event) => setModel(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border p-4">
          <Button size="sm" loading={saving} onClick={() => void save()}>
            Save recipe
          </Button>
        </div>
      </Card>
    </div>
  );
}
