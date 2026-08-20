import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ApprovalStatusSchema,
  parseMapOr,
  parseOr,
  PrivacySchema,
  RoleSchema,
  rtdbList,
  timestampMs,
} from "./common";

describe("rtdbList", () => {
  const schema = rtdbList(z.string());

  it("normaliza null a array vacío (nodo ausente)", () => {
    expect(schema.parse(null)).toEqual([]);
  });

  it("normaliza undefined a array vacío", () => {
    expect(schema.parse(undefined)).toEqual([]);
  });

  it("deja pasar un array denso tal cual", () => {
    expect(schema.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("filtra huecos null dentro de un array", () => {
    expect(schema.parse(["a", null, "b"])).toEqual(["a", "b"]);
  });

  it("normaliza un objeto con claves numéricas (array disperso de RTDB)", () => {
    expect(schema.parse({ "0": "a", "2": "b" })).toEqual(["a", "b"]);
  });

  it("filtra valores null dentro del objeto disperso", () => {
    expect(schema.parse({ "0": "a", "1": null, "2": "b" })).toEqual(["a", "b"]);
  });

  it("cualquier otro tipo (string, número) cae a array vacío", () => {
    expect(schema.parse("no-es-una-lista")).toEqual([]);
    expect(schema.parse(42)).toEqual([]);
  });
});

describe("RoleSchema", () => {
  it("acepta los tres roles válidos", () => {
    expect(RoleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(RoleSchema.parse("COACH")).toBe("COACH");
    expect(RoleSchema.parse("PLAYER")).toBe("PLAYER");
  });

  it("absorbe un valor ausente cayendo a PLAYER (espeja el default de Kotlin)", () => {
    expect(RoleSchema.parse(undefined)).toBe("PLAYER");
  });

  it("absorbe un valor corrupto/legacy cayendo a PLAYER, sin lanzar", () => {
    expect(RoleSchema.parse("legacy-role-invalido")).toBe("PLAYER");
    expect(RoleSchema.parse(null)).toBe("PLAYER");
    expect(RoleSchema.parse(123)).toBe("PLAYER");
  });
});

describe("PrivacySchema", () => {
  it("acepta los tres valores válidos", () => {
    for (const v of ["Publico", "Privado", "Equipo"]) {
      expect(PrivacySchema.parse(v)).toBe(v);
    }
  });

  it("NO tiene catch — un valor inválido debe fallar el parse", () => {
    expect(PrivacySchema.safeParse("Otro").success).toBe(false);
    expect(PrivacySchema.safeParse(null).success).toBe(false);
  });
});

describe("ApprovalStatusSchema", () => {
  it("acepta los tres estados válidos", () => {
    for (const v of ["PENDING", "APPROVED", "REJECTED"]) {
      expect(ApprovalStatusSchema.parse(v)).toBe(v);
    }
  });

  it("null/undefined son válidos (contenido legacy anterior al sistema de aprobación)", () => {
    expect(ApprovalStatusSchema.parse(null)).toBeNull();
    expect(ApprovalStatusSchema.parse(undefined)).toBeUndefined();
  });

  it("un valor fuera del enum falla el parse (sin catch)", () => {
    expect(ApprovalStatusSchema.safeParse("EN_REVISION").success).toBe(false);
  });
});

describe("timestampMs", () => {
  it("acepta un entero", () => {
    expect(timestampMs.parse(1_753_000_000_000)).toBe(1_753_000_000_000);
  });

  it("rechaza un no-entero", () => {
    expect(timestampMs.safeParse(1.5).success).toBe(false);
  });
});

describe("parseOr", () => {
  const schema = z.object({ name: z.string() });

  it("devuelve el objeto parseado cuando es válido", () => {
    expect(parseOr(schema, { name: "Ejercicio" }, "test")).toEqual({ name: "Ejercicio" });
  });

  it("devuelve null (no lanza) cuando el dato es inválido, y loguea un warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseOr(schema, { name: 123 }, "Exercises/foo")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Exercises/foo"),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it("devuelve null cuando el nodo raíz es null (nunca revienta con un objeto ausente)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseOr(schema, null, "test")).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("parseMapOr", () => {
  const schema = z.object({ name: z.string() });

  it("parsea un mapa RTDB {clave: item} a una lista", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseMapOr(schema, { a: { name: "Uno" }, b: { name: "Dos" } }, "test");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name).sort()).toEqual(["Dos", "Uno"]);
    warnSpy.mockRestore();
  });

  it("descarta items corruptos individuales sin descartar el resto", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseMapOr(
      schema,
      { a: { name: "Válido" }, b: { name: 42 }, c: { name: "OtroVálido" } },
      "test",
    );
    expect(result.map((r) => r.name).sort()).toEqual(["OtroVálido", "Válido"]);
    warnSpy.mockRestore();
  });

  it("devuelve [] cuando el nodo raíz es null/no-objeto", () => {
    expect(parseMapOr(schema, null, "test")).toEqual([]);
    expect(parseMapOr(schema, "no-es-un-mapa", "test")).toEqual([]);
  });
});
