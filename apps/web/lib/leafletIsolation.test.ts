import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Leaflet gives its panes and controls z-indexes from 400 to 1000. If the element that holds a map
 * does not start its own stacking context (Tailwind `isolate`), those values compete with the whole
 * page and the map paints above dialogs and sheets (z-50), hiding them. This happened with the
 * Reset demo confirmation, so every component that creates a Leaflet map must isolate it.
 */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("Leaflet maps do not paint above dialogs", () => {
  const mapComponents = sourceFiles(join(__dirname, "..", "components")).filter((path) => /import\(["']leaflet["']\)|from ["']leaflet["']/.test(readFileSync(path, "utf8")));

  it("finds the map components", () => {
    expect(mapComponents.map((path) => path.split("/").pop()).sort()).toEqual(["OperationsMap.tsx", "RouteMap.tsx"]);
  });

  it.each(mapComponents.map((path) => [path.split("/").pop(), path] as const))("%s isolates its map container", (_name, path) => {
    expect(readFileSync(path, "utf8")).toMatch(/className=\{?cn\("[^"]*\bisolate\b/);
  });
});
