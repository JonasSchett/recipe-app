"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ImagePlus,
  Plus,
  ScanText,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import type { EntitySuggestion } from "@/lib/suggest";
import { createRecipe, updateRecipe } from "@/lib/actions/recipes";
import { discardRecipeImage, uploadRecipeImage } from "@/lib/actions/images";
import { extractTextFromRecipeImage } from "@/lib/actions/ocr";
import { extractEntitiesFromText } from "@/lib/actions/extract";

type IngredientRow = { name: string; quantity: string; unit: string };

export type RecipeFormInitial = {
  title: string;
  description: string;
  instructions: string;
  visibility: "PRIVATE" | "PUBLIC";
  imagePaths: string[];
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  tags: string[];
};

const EMPTY: RecipeFormInitial = {
  title: "",
  description: "",
  instructions: "",
  visibility: "PRIVATE",
  imagePaths: [],
  ingredients: [],
  tags: [],
};

/** Tidy a raw text selection into a candidate ingredient/tag name. */
function cleanSelectedText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Autocomplete vocabulary, preloaded by the page (see `getEntityVocabulary`). */
export type RecipeFormVocabulary = {
  ingredients: EntitySuggestion[];
  tags: EntitySuggestion[];
};

const NO_VOCABULARY: RecipeFormVocabulary = { ingredients: [], tags: [] };

export function RecipeForm({
  mode,
  recipeId,
  initial = EMPTY,
  vocabulary = NO_VOCABULARY,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  initial?: RecipeFormInitial;
  vocabulary?: RecipeFormVocabulary;
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

  // Ordered gallery of already-uploaded image paths; index 0 is the hero image.
  const [images, setImages] = useState<string[]>(initial.imagePaths);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Paths present when the form loaded — these belong to the saved recipe, so we
  // defer deleting their files to updateRecipe rather than discarding on remove.
  const initialImagePaths = useRef(new Set(initial.imagePaths));
  const [imageBusy, setImageBusy] = useState(false);
  const [ocrBusyPath, setOcrBusyPath] = useState<string | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);
  // Current text selection inside the instructions field (for quick-add).
  const [selection, setSelection] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  function addTag(name = tagDraft) {
    const value = name.trim();
    if (value && !tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTags((t) => [...t, value]);
    }
    setTagDraft("");
  }
  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  async function onAddImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file later
    if (files.length === 0) return;

    setError(null);
    setImageBusy(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.set("image", file);
        const { path } = await uploadRecipeImage(fd);
        setImages((prev) => [...prev, path]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setImageBusy(false);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeImageAt(index: number) {
    const path = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    // Files for newly-uploaded images can be cleaned up now; files belonging to
    // the saved recipe are removed by updateRecipe once the user submits.
    if (!initialImagePaths.current.has(path)) {
      void discardRecipeImage(path).catch(() => {});
    }
  }

  // Add detected ingredient/tag names that aren't already present (case-
  // insensitive). Suggestions only — the user can edit or remove them.
  function mergeDetected(found: { ingredients: string[]; tags: string[] }) {
    if (found.ingredients.length > 0) {
      setIngredients((rows) => {
        const have = new Set(
          rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean),
        );
        const additions = found.ingredients
          .filter((name) => !have.has(name.toLowerCase()))
          .map((name) => ({ name, quantity: "", unit: "" }));
        return additions.length ? [...rows, ...additions] : rows;
      });
    }
    if (found.tags.length > 0) {
      setTags((prev) => {
        const have = new Set(prev.map((t) => t.toLowerCase()));
        const additions = found.tags.filter((t) => !have.has(t.toLowerCase()));
        return additions.length ? [...prev, ...additions] : prev;
      });
    }
  }

  async function runOcr(path: string) {
    setError(null);
    setOcrBusyPath(path);
    try {
      const { text } = await extractTextFromRecipeImage(path);
      if (!text) {
        setError("No text could be extracted from that image.");
        return;
      }
      // Append to any existing instructions rather than overwriting them.
      setInstructions((prev) =>
        prev.trim() ? `${prev.trim()}\n\n${text}` : text,
      );
      // Auto-suggest ingredients/tags found in the freshly scanned text.
      mergeDetected(await extractEntitiesFromText(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Text extraction failed.");
    } finally {
      setOcrBusyPath(null);
    }
  }

  function onInstructionsSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setSelection(
      cleanSelectedText(el.value.slice(el.selectionStart, el.selectionEnd)),
    );
  }

  function addSelectedIngredient() {
    const name = selection;
    if (!name) return;
    setIngredients((rows) =>
      rows.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())
        ? rows
        : [...rows, { name, quantity: "", unit: "" }],
    );
    setSelection("");
  }

  function addSelectedTag() {
    const value = selection;
    if (!value) return;
    setTags((prev) =>
      prev.some((t) => t.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value],
    );
    setSelection("");
  }

  // Scan whatever text is in the instructions field for known ingredients/tags.
  async function detectEntities() {
    const source = instructions.trim();
    if (!source) {
      setError("Add or extract some instructions text first.");
      return;
    }
    setError(null);
    setDetectBusy(true);
    try {
      const found = await extractEntitiesFromText(source);
      mergeDetected(found);
      if (found.ingredients.length === 0 && found.tags.length === 0) {
        setError("No known ingredients or tags found in the text.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed.");
    } finally {
      setDetectBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required.");

    setSubmitting(true);
    try {
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
        instructions: instructions.trim() || null,
        visibility: isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const),
        imagePaths: images,
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
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onSelect={onInstructionsSelect}
          className="min-h-40"
          placeholder="Step-by-step instructions (optional — the photos may say it all)."
        />
        {selection ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Add</span>
            <span className="max-w-[16rem] truncate font-medium">
              “{selection}”
            </span>
            <span className="text-muted-foreground">as</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addSelectedIngredient}
            >
              <Plus className="h-4 w-4" /> Ingredient
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addSelectedTag}
            >
              <Plus className="h-4 w-4" /> Tag
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tip: highlight a word in the text to quickly add it as an ingredient
            or tag.
          </p>
        )}
      </div>

      {/* Ingredients */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Ingredients</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={detectEntities}
            disabled={detectBusy}
          >
            <Sparkles className="h-4 w-4" />
            {detectBusy ? "Detecting…" : "Detect from text"}
          </Button>
        </div>
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
              <EntityAutocomplete
                className="flex-1"
                value={row.name}
                onValueChange={(name) => updateIngredient(i, { name })}
                onPick={(match) => updateIngredient(i, { name: match.label })}
                vocabulary={vocabulary.ingredients}
                // Don't re-offer an ingredient another row already uses — the
                // composite PK forbids the same ingredient twice on a recipe.
                exclude={ingredients
                  .filter((_, other) => other !== i)
                  .map((r) => r.name)}
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
          <EntityAutocomplete
            className="flex-1"
            id="tag"
            value={tagDraft}
            onValueChange={setTagDraft}
            // Picking a suggestion adds it straight away, like pressing Enter.
            onPick={(match) => addTag(match.label)}
            onEnter={() => addTag()}
            vocabulary={vocabulary.tags}
            exclude={tags}
            placeholder="Add a tag and press Enter"
          />
          <Button type="button" variant="outline" onClick={() => addTag()}>
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

      {/* Images */}
      <div className="flex flex-col gap-2">
        <Label>Images</Label>
        {images.length > 0 && (
          <ul className="flex flex-col gap-2">
            {images.map((path, i) => (
              <li
                key={path}
                className="flex items-center gap-3 rounded-md border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files */}
                <img
                  src={path}
                  alt={`Recipe image ${i + 1}`}
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  {i === 0 ? (
                    <Badge variant="default">Hero image</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Image {i + 1}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveImage(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move image ${i + 1} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveImage(i, 1)}
                    disabled={i === images.length - 1}
                    aria-label={`Move image ${i + 1} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => runOcr(path)}
                    disabled={ocrBusyPath !== null}
                  >
                    <ScanText className="h-4 w-4" />
                    {ocrBusyPath === path ? "Extracting…" : "Extract text"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImageAt(i)}
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onAddImages}
        />
        {/*
          Camera capture. `capture="environment"` asks a phone to open the rear
          camera directly instead of the file picker; the browser/OS handles the
          permission prompt, so there is nothing to request here. Desktop
          browsers ignore the attribute and just show a picker, which is a fine
          fallback. Kept as a separate input because it also needs the broader
          `image/*` accept (a phone camera is not offered for a MIME allow-list)
          and takes one shot at a time.
        */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onAddImages}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageBusy}
          >
            <ImagePlus className="h-4 w-4" />
            {imageBusy ? "Uploading…" : "Add images"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={imageBusy}
          >
            <Camera className="h-4 w-4" />
            Take photo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP or GIF, up to 5 MB each. The first image is the hero
          shown on cards — reorder with the arrows. “Take photo” opens the camera
          on a phone. Use “Extract text” to OCR a photo of a recipe into the
          instructions above.
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
        <Button type="submit" disabled={submitting || imageBusy}>
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
