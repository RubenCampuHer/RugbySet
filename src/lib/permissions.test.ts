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
  type ClubContext,
  getRoleDisplayName,
  isAdmin,
  isCoach,
  isTeamCoach,
  isTeamFounder,
} from "./permissions";
import { ExerciseSchema } from "./schemas/exercise";
import { TeamSchema } from "./schemas/team";
import { TrainingSchema } from "./schemas/training";
import { UserSchema } from "./schemas/user";
import type { Exercise, Team, Training, User } from "./types";

function user(overrides: Partial<Parameters<typeof UserSchema.parse>[0]> = {}): User {
  return UserSchema.parse({ username: "author1", role: "PLAYER", ...overrides });
}

function exercise(overrides: Partial<Parameters<typeof ExerciseSchema.parse>[0]> = {}): Exercise {
  return ExerciseSchema.parse({ name: "Pase", author: "author1", ...overrides });
}

function training(overrides: Partial<Parameters<typeof TrainingSchema.parse>[0]> = {}): Training {
  return TrainingSchema.parse({ name: "Entreno", author: "author1", ...overrides });
}

function team(overrides: Partial<Parameters<typeof TeamSchema.parse>[0]> = {}): Team {
  return TeamSchema.parse({ teamname: "Spartans", usercoach: "founder-uid", ...overrides });
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
    club?: ClubContext;
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
      label: "Club + APPROVED: el autor sí, aunque no pertenezca a ningún club",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "APPROVED" },
      expected: true,
    },
    {
      label: "Club + APPROVED: un miembro del mismo club sí",
      viewer: user({ username: "compañero" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "APPROVED" },
      club: { myClubId: "club1" },
      expected: true,
    },
    {
      label: "Club + APPROVED: alguien de otro club no",
      viewer: user({ username: "rival" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "APPROVED" },
      club: { myClubId: "club2" },
      expected: false,
    },
    {
      label: "Club + PENDING: el autor sí",
      viewer: user({ username: "author1" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "PENDING" },
      expected: true,
    },
    {
      label: "Club + PENDING: el admin de ESE club sí (cola de aprobación del club)",
      viewer: user({ username: "admin_club" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "PENDING" },
      club: { myClubId: "club1", myAdminClubId: "club1" },
      expected: true,
    },
    {
      label: "Club + PENDING: un miembro del club que NO lo administra no",
      viewer: user({ username: "compañero" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "PENDING" },
      club: { myClubId: "club1" },
      expected: false,
    },
    {
      label: "Club + PENDING: un ADMIN GLOBAL no (a diferencia de Publico — aquí solo cuenta el admin del club)",
      viewer: user({ username: "admin1", role: "ADMIN" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "PENDING" },
      expected: false,
    },
    {
      label: "Club + REJECTED: solo el autor",
      viewer: user({ username: "compañero" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: "REJECTED" },
      club: { myClubId: "club1", myAdminClubId: "club1" },
      expected: false,
    },
    {
      label: "Club + approvalStatus null (legacy): solo el autor, ni siquiera el admin del club",
      viewer: user({ username: "admin_club" }),
      contentOverrides: { privacy: "Club", clubId: "club1", approvalStatus: null },
      club: { myClubId: "club1", myAdminClubId: "club1" },
      expected: false,
    },
    {
      label: "Club: sin clubId asignado (dato corrupto), nadie salvo el autor lo ve",
      viewer: user({ username: "compañero" }),
      contentOverrides: { privacy: "Club", clubId: null, approvalStatus: "APPROVED" },
      club: { myClubId: "club1" },
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

  for (const { label, viewer, contentOverrides, club, expected } of cases) {
    it(`Exercise — ${label}`, () => {
      expect(canViewExercise(viewer, exercise(contentOverrides), club)).toBe(expected);
    });
    it(`Training — ${label}`, () => {
      expect(canViewTraining(viewer, training(contentOverrides), club)).toBe(expected);
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

describe("isTeamCoach / isTeamFounder (varios entrenadores, rediseño 2026-09-03)", () => {
  it("isTeamCoach reconoce al fundador (usercoach)", () => {
    expect(isTeamCoach(team(), "founder-uid")).toBe(true);
  });

  it("isTeamCoach reconoce a un co-entrenador ya aceptado (coaches)", () => {
    const t = team({ coaches: { "co-uid": true } });
    expect(isTeamCoach(t, "co-uid")).toBe(true);
  });

  it("isTeamCoach NO reconoce a alguien todavía pendiente de aceptar", () => {
    const t = team({ pendingCoaches: { "pending-uid": true } });
    expect(isTeamCoach(t, "pending-uid")).toBe(false);
  });

  it("isTeamCoach es false para un jugador cualquiera o un uid ausente", () => {
    expect(isTeamCoach(team(), "player-uid")).toBe(false);
    expect(isTeamCoach(team(), null)).toBe(false);
    expect(isTeamCoach(team(), undefined)).toBe(false);
  });

  it("isTeamFounder solo es true para el usercoach original, nunca para un co-entrenador", () => {
    const t = team({ coaches: { "co-uid": true } });
    expect(isTeamFounder(t, "founder-uid")).toBe(true);
    expect(isTeamFounder(t, "co-uid")).toBe(false);
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
