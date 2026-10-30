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
import { createRecipe, deleteRecipe, fetchRecipes, type RecipeRow } from "@/lib/api";
import Link from "next/link";

export default function RecipesPage() {
  const toast = useToast();
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchRecipes();
    if (result.data) setRecipes(result.data.recipes);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    const result = await createRecipe({ name: "New recipe", prompt: "Summarise the meeting.", scope: "single" });
    setCreating(false);
    if (result.error || !result.data) {
      toast.push({ tone: "error", title: "Recipe could not be created", description: result.error ?? undefined });
      return;
    }
    window.location.href = `/app/recipes/${result.data.id}/edit`;
  };

  const remove = async (recipe: RecipeRow) => {
    if (!window.confirm(`Delete “${recipe.name}”?`)) return;
    const result = await deleteRecipe(recipe.id);
    if (result.error) {
      toast.push({ tone: "error", title: "Recipe could not be deleted", description: result.error });
      return;
    }
    toast.push({ tone: "success", title: "Recipe deleted" });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Recipes</h2>
          <p className="text-sm text-text-muted">
            Saved prompts you can run across one or many meetings.
          </p>
        </div>
        <Button size="sm" loading={creating} onClick={() => void create()}>
          New recipe
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Recipes could not be loaded"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : recipes.length === 0 ? (
        <Card>
          <EmptyState
            title="No recipes yet"
            description="Create a recipe to run a saved prompt across your meetings."
            action={
              <Button size="sm" onClick={() => void create()}>
                New recipe
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="flex flex-col">
              <CardHeader
                title={recipe.name}
                description={recipe.scope === "single" ? "Single meeting" : "Multiple meetings"}
                actions={<Badge tone="neutral">v{recipe.version}</Badge>}
              />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="line-clamp-3 text-sm text-text-muted">{recipe.prompt}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-text-muted">
                    {recipe.ownerName} · {recipe.visibility}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/recipes/${recipe.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => void remove(recipe)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
