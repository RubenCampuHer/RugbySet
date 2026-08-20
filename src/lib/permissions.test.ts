// Tests de la única lógica de negocio real del MVP (comentario original en
// lib/schemas/*.ts) — port literal de PermissionsManager.kt. Las fixtures se
// construyen parseando los propios schemas Zod (no objetos a mano) para que
// los tests fallen si el schema y el heurístico se desincronizan.
import { describe, expect, it } from "vitest";
import {
  canCreateContent,
  canDeleteExercise,
  canDeleteTraining,
  canEditExercise,
  canEditTraining,
  canViewExercise,
  canViewTraining,
  getRoleDisplayName,
  isAdmin,
  isCoach,
} from "./permissions";
import { ExerciseSchema } from "./schemas/exercise";
import { TrainingSchema } from "./schemas/training";
import { UserSchema } from "./schemas/user";
import type { Exercise, Training, User } from "./types";

function user(overrides: Partial<Parameters<typeof UserSchema.parse>[0]> = {}): User {
  return UserSchema.parse({ username: "author1", role: "PLAYER", ...overrides });
}

function exercise(overrides: Partial<Parameters<typeof ExerciseSchema.parse>[0]> = {}): Exercise {
  return ExerciseSchema.parse({ name: "Pase", author: "author1", ...overrides });
}

function training(overrides: Partial<Parameters<typeof TrainingSchema.parse>[0]> = {}): Training {
  return TrainingSchema.parse({ name: "Entreno", author: "author1", ...overrides });
}

describe("isAdmin / isCoach / canCreateContent", () => {
  it("clasifica cada rol", () => {
    expect(isAdmin(user({ role: "ADMIN" }))).toBe(true);
    expect(isAdmin(user({ role: "COACH" }))).toBe(false);
    expect(isCoach(user({ role: "COACH" }))).toBe(true);
    expect(isCoach(user({ role: "PLAYER" }))).toBe(false);
  });

  it("canCreateContent es true para ADMIN y COACH, false para PLAYER", () => {
    expect(canCreateContent(user({ role: "ADMIN" }))).toBe(true);
    expect(canCreateContent(user({ role: "COACH" }))).toBe(true);
    expect(canCreateContent(user({ role: "PLAYER" }))).toBe(false);
  });

  it("user null nunca es admin/coach/creador", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isCoach(null)).toBe(false);
    expect(canCreateContent(null)).toBe(false);
  });
});

describe("canViewExercise / canViewTraining — matriz privacy × approvalStatus", () => {
  // Se ejecuta la misma matriz para Exercise y Training, ya que
  // permissions.ts implementa exactamente la misma lógica para ambos.
  const cases: Array<{
    label: string;
    viewer: User;
    contentOverrides: Record<string, unknown>;
    expected: boolean;
  }> = [
    {
      label: "Privado: el propio autor sí",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Privado" },
      expected: true,
    },
    {
      label: "Privado: otro jugador no",
      viewer: user({ username: "otro" }),
      contentOverrides: { privacy: "Privado" },
      expected: false,
    },
    {
      label: "Privado: ni siquiera un ADMIN (privado es privado)",
      viewer: user({ username: "admin1", role: "ADMIN" }),
      contentOverrides: { privacy: "Privado" },
      expected: false,
    },
    {
      label: "Equipo: el autor sí, aunque no tenga teamname",
      viewer: user({ username: "author1", teamname: null }),
      contentOverrides: { privacy: "Equipo", teamname: "Spartans" },
      expected: true,
    },
    {
      label: "Equipo: un compañero del mismo equipo sí",
      viewer: user({ username: "compañero", teamname: "Spartans" }),
      contentOverrides: { privacy: "Equipo", teamname: "Spartans" },
      expected: true,
    },
    {
      label: "Equipo: alguien de otro equipo no",
      viewer: user({ username: "rival", teamname: "Tigers" }),
      contentOverrides: { privacy: "Equipo", teamname: "Spartans" },
      expected: false,
    },
    {
      label: "Equipo: el contenido sin teamname asignado no es visible ni para un compañero sin equipo",
      viewer: user({ username: "sinequipo", teamname: null }),
      contentOverrides: { privacy: "Equipo", teamname: null },
      expected: false,
    },
    {
      label: "Publico + APPROVED: cualquiera lo ve",
      viewer: user({ username: "cualquiera" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "APPROVED" },
      expected: true,
    },
    {
      label: "Publico + PENDING: el autor sí",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "PENDING" },
      expected: true,
    },
    {
      label: "Publico + PENDING: un ADMIN sí (cola de aprobación)",
      viewer: user({ username: "admin1", role: "ADMIN" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "PENDING" },
      expected: true,
    },
    {
      label: "Publico + PENDING: un jugador cualquiera no",
      viewer: user({ username: "otro" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "PENDING" },
      expected: false,
    },
    {
      label: "Publico + REJECTED: solo el autor",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "REJECTED" },
      expected: true,
    },
    {
      label: "Publico + REJECTED: un ADMIN NO (a diferencia de PENDING)",
      viewer: user({ username: "admin1", role: "ADMIN" }),
      contentOverrides: { privacy: "Publico", approvalStatus: "REJECTED" },
      expected: false,
    },
    {
      label: "Publico + approvalStatus null (legacy): solo el autor",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Publico", approvalStatus: null },
      expected: true,
    },
    {
      label: "Publico + approvalStatus null (legacy): otro no",
      viewer: user({ username: "otro" }),
      contentOverrides: { privacy: "Publico", approvalStatus: null },
      expected: false,
    },
  ];

  for (const { label, viewer, contentOverrides, expected } of cases) {
    it(`Exercise — ${label}`, () => {
      expect(canViewExercise(viewer, exercise(contentOverrides))).toBe(expected);
    });
    it(`Training — ${label}`, () => {
      expect(canViewTraining(viewer, training(contentOverrides))).toBe(expected);
    });
  }

  it("user null nunca ve nada, sea lo que sea el contenido", () => {
    expect(canViewExercise(null, exercise({ privacy: "Publico", approvalStatus: "APPROVED" }))).toBe(
      false,
    );
    expect(canViewTraining(null, training({ privacy: "Publico", approvalStatus: "APPROVED" }))).toBe(
      false,
    );
  });
});

describe("canEditExercise / canDeleteExercise", () => {
  it("ADMIN puede editar cualquier ejercicio, sea o no el autor", () => {
    expect(canEditExercise(user({ role: "ADMIN", username: "admin1" }), exercise())).toBe(true);
  });

  it("COACH solo puede editar lo propio", () => {
    expect(canEditExercise(user({ role: "COACH", username: "author1" }), exercise())).toBe(true);
    expect(canEditExercise(user({ role: "COACH", username: "otro-coach" }), exercise())).toBe(false);
  });

  it("PLAYER nunca puede editar, ni lo suyo", () => {
    expect(canEditExercise(user({ role: "PLAYER", username: "author1" }), exercise())).toBe(false);
  });

  it("user null no puede editar", () => {
    expect(canEditExercise(null, exercise())).toBe(false);
  });

  it("canDeleteExercise es literalmente el mismo comportamiento que canEditExercise", () => {
    expect(canDeleteExercise).toBe(canEditExercise);
  });
});

describe("canEditTraining / canDeleteTraining", () => {
  it("mismo esquema ADMIN/COACH-propio/PLAYER-nunca que Exercise", () => {
    expect(canEditTraining(user({ role: "ADMIN" }), training())).toBe(true);
    expect(canEditTraining(user({ role: "COACH", username: "author1" }), training())).toBe(true);
    expect(canEditTraining(user({ role: "COACH", username: "otro" }), training())).toBe(false);
    expect(canEditTraining(user({ role: "PLAYER", username: "author1" }), training())).toBe(false);
  });

  it("canDeleteTraining es el mismo comportamiento que canEditTraining", () => {
    expect(canDeleteTraining).toBe(canEditTraining);
  });
});

describe("getRoleDisplayName", () => {
  it("traduce los tres roles conocidos", () => {
    expect(getRoleDisplayName("ADMIN")).toBe("Administrador");
    expect(getRoleDisplayName("COACH")).toBe("Entrenador");
    expect(getRoleDisplayName("PLAYER")).toBe("Jugador");
  });

  it("cualquier otro valor (o ausente) cae a 'Desconocido'", () => {
    expect(getRoleDisplayName(null)).toBe("Desconocido");
    expect(getRoleDisplayName(undefined)).toBe("Desconocido");
    expect(getRoleDisplayName("ROL_INVENTADO")).toBe("Desconocido");
  });
});
