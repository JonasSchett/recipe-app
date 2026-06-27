"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Plus, ScanText, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createRecipe, updateRecipe } from "@/lib/actions/recipes";
import { uploadRecipeImage } from "@/lib/actions/images";
import { extractTextFromImage } from "@/lib/actions/ocr";

type IngredientRow = { name: string; quantity: string; unit: string };

export type RecipeFormInitial = {
  title: string;
  description: string;
  instructions: string;
  visibility: "PRIVATE" | "PUBLIC";
  imagePath: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  tags: string[];
};

const EMPTY: RecipeFormInitial = {
  title: "",
  description: "",
  instructions: "",
  visibility: "PRIVATE",
  imagePath: null,
  ingredients: [],
  tags: [],
};

export function RecipeForm({
  mode,
  recipeId,
  initial = EMPTY,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  initial?: RecipeFormInitial;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [isPublic, setIsPublic] = useState(initial.visibility === "PUBLIC");
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity?.toString() ?? "",
      unit: i.unit ?? "",
    })),
  );
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial.imagePath);
  const [removeImage, setRemoveImage] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // OCR: a separate file input so the scanned source (e.g. a photo of a cookbook
  // page) is independent of the recipe's display image.
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  async function onPickOcrImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setOcrBusy(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const { text } = await extractTextFromImage(fd);
      if (!text) {
        setError("No text could be extracted from that image.");
        return;
      }
      // Append to any existing instructions rather than overwriting them.
      setInstructions((prev) =>
        prev.trim() ? `${prev.trim()}\n\n${text}` : text,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Text extraction failed.");
    } finally {
      setOcrBusy(false);
    }
  }

  function addIngredient() {
    setIngredients((rows) => [...rows, { name: "", quantity: "", unit: "" }]);
  }
  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeIngredient(index: number) {
    setIngredients((rows) => rows.filter((_, i) => i !== index));
  }

  function addTag() {
    const value = tagDraft.trim();
    if (value && !tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTags((t) => [...t, value]);
    }
    setTagDraft("");
  }
  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(file ? URL.createObjectURL(file) : initial.imagePath);
  }
  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required.");
    if (!instructions.trim()) return setError("Instructions are required.");

    setSubmitting(true);
    try {
      // Resolve the image path: upload a new file, keep existing, or clear it.
      let imagePath: string | null = initial.imagePath;
      if (imageFile) {
        const fd = new FormData();
        fd.set("image", imageFile);
        imagePath = (await uploadRecipeImage(fd)).path;
      } else if (removeImage) {
        imagePath = null;
      }

      const parsedIngredients = ingredients
        .filter((row) => row.name.trim())
        .map((row) => {
          const q = row.quantity.trim();
          return {
            name: row.name.trim(),
            quantity: q === "" ? null : Number(q),
            unit: row.unit.trim() || null,
          };
        });

      if (parsedIngredients.some((i) => i.quantity !== null && !(i.quantity! > 0))) {
        setSubmitting(false);
        return setError("Ingredient quantities must be positive numbers.");
      }

      const input = {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim(),
        visibility: isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const),
        imagePath,
        ingredients: parsedIngredients,
        tags,
      };

      const result =
        mode === "edit" && recipeId
          ? await updateRecipe(recipeId, input)
          : await createRecipe(input);

      router.push(`/recipes/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Grandma's tomato soup"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short summary of the dish."
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="instructions">Instructions</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ocrInputRef.current?.click()}
            disabled={ocrBusy}
          >
            <ScanText className="h-4 w-4" />
            {ocrBusy ? "Extracting…" : "Extract text from image"}
          </Button>
        </div>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="min-h-40"
          placeholder="Step-by-step instructions."
          required
        />
        <input
          ref={ocrInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onPickOcrImage}
        />
        <p className="text-xs text-muted-foreground">
          Snap a photo or screenshot of a recipe to extract its text into this
          field, then edit as needed.
        </p>
      </div>

      {/* Ingredients */}
      <div className="flex flex-col gap-2">
        <Label>Ingredients</Label>
        <div className="flex flex-col gap-2">
          {ingredients.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="w-20"
                type="number"
                step="any"
                min="0"
                value={row.quantity}
                onChange={(e) => updateIngredient(i, { quantity: e.target.value })}
                placeholder="Qty"
                aria-label={`Ingredient ${i + 1} quantity`}
              />
              <Input
                className="w-24"
                value={row.unit}
                onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                placeholder="Unit"
                aria-label={`Ingredient ${i + 1} unit`}
              />
              <Input
                className="flex-1"
                value={row.name}
                onChange={(e) => updateIngredient(i, { name: e.target.value })}
                placeholder="Ingredient name"
                aria-label={`Ingredient ${i + 1} name`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeIngredient(i)}
                aria-label="Remove ingredient"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
          <Plus className="h-4 w-4" /> Add ingredient
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tag">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tag"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="rounded-full hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Image */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="image">Image</Label>
        {imagePreview && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Recipe preview"
              className="h-40 w-40 rounded-md border object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6"
              onClick={clearImage}
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <Input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPickImage}
        />
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP or GIF, up to 5 MB.
        </p>
      </div>

      {/* Visibility */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4"
        />
        Make this recipe public (visible to everyone)
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Create recipe"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
