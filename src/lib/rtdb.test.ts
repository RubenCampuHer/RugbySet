import { describe, expect, it } from "vitest";
import { mergeNode, rawList } from "./rtdb";

describe("mergeNode", () => {
  it("conserva claves desconocidas del nodo existente", () => {
    const out = mergeNode({ name: "A", stability: 3, created_at: 1 }, { name: "B" });
    expect(out).toEqual({ name: "B", stability: 3, created_at: 1 });
  });

  it("null o undefined en el overlay borra la clave", () => {
    const out = mergeNode({ a: 1, b: 2, c: 3 }, { b: null, c: undefined });
    expect(out).toEqual({ a: 1 });
  });

  it("sin nodo existente devuelve solo el overlay sin nulos", () => {
    expect(mergeNode(null, { a: 1, b: null })).toEqual({ a: 1 });
    expect(mergeNode("basura", { a: 1 })).toEqual({ a: 1 });
  });

  it("no muta el nodo de entrada", () => {
    const existing = { a: 1 };
    mergeNode(existing, { a: 2, b: 3 });
    expect(existing).toEqual({ a: 1 });
  });
});

describe("rawList", () => {
  it("acepta arrays y mapas numéricos dispersos, en orden", () => {
    expect(rawList([{ a: 1 }, null, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
    expect(rawList({ "10": { a: 3 }, "2": { a: 2 }, "0": { a: 1 } })).toEqual([
      { a: 1 },
      { a: 2 },
      { a: 3 },
    ]);
  });

  it("null y valores no objeto dan lista vacía", () => {
    expect(rawList(null)).toEqual([]);
    expect(rawList(undefined)).toEqual([]);
    expect(rawList("x")).toEqual([]);
    expect(rawList([1, "a"])).toEqual([]);
  });
});
