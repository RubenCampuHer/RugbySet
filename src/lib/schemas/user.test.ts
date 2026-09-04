import { describe, expect, it } from "vitest";
import { NotificationSchema, PublicProfileSchema, UserSchema, UserTeamsSchema } from "./user";

describe("UserSchema", () => {
  it("parsea un perfil completo", () => {
    const result = UserSchema.parse({
      userId: "uid1",
      username: "rudyx28",
      nameSurname: "Ruben Campuzano",
      teamname: "Spartans",
      mail: "ruben@example.com",
      usericon: "https://example.com/icon.png",
      assistedTrainingDays: ["01/01/2026"],
      favExercises: ["Pase"],
      favTrainings: [],
      role: "COACH",
      onboardingComplete: true,
    });
    expect(result.role).toBe("COACH");
    expect(result.onboardingComplete).toBe(true);
    expect(result.teamname).toBe("Spartans");
  });

  it("un perfil mínimo (solo campos requeridos por defecto) parsea con defaults sensatos", () => {
    const result = UserSchema.parse({});
    expect(result.role).toBe("PLAYER"); // RoleSchema.catch
    expect(result.teamname).toBeUndefined();
    expect(result.assistedTrainingDays).toEqual([]);
    expect(result.favExercises).toEqual([]);
    expect(result.favTrainings).toEqual([]);
  });

  it("onboardingComplete ausente/null es válido (perfiles creados antes del backfill)", () => {
    expect(UserSchema.parse({}).onboardingComplete).toBeUndefined();
    expect(UserSchema.parse({ onboardingComplete: null }).onboardingComplete).toBeNull();
  });

  it("onboardingComplete con un tipo incorrecto NO tiene catch — falla el parse del perfil entero", () => {
    // Importante: esto es justo el fallo que hay que evitar en el propio dato
    // (a diferencia de "role", este campo no absorbe basura). Si algún día
    // se escribe un valor no-booleano aquí, AuthProvider volvería a ver el
    // perfil como null — exactamente el bug original que motivó el fix.
    expect(UserSchema.safeParse({ onboardingComplete: "sí" }).success).toBe(false);
  });

  it("listas dispersas de RTDB (objeto con índices) se normalizan igual que en Android", () => {
    const result = UserSchema.parse({
      assistedTrainingDays: { "0": "01/01/2026", "2": "03/01/2026" },
    });
    expect(result.assistedTrainingDays).toEqual(["01/01/2026", "03/01/2026"]);
  });
});

describe("UserTeamsSchema", () => {
  it("parsea el mapa {teamname: true} de pertenencias", () => {
    expect(UserTeamsSchema.parse({ Spartans: true, "Rugby Granollers": true })).toEqual({
      Spartans: true,
      "Rugby Granollers": true,
    });
  });

  it("null (usuario sin ninguna pertenencia todavía) → mapa vacío", () => {
    expect(UserTeamsSchema.parse(null)).toEqual({});
  });

  it("un valor distinto de true no es válido (la .validate de la regla lo impide igualmente)", () => {
    expect(UserTeamsSchema.safeParse({ Spartans: false }).success).toBe(false);
    expect(UserTeamsSchema.safeParse({ Spartans: "sí" }).success).toBe(false);
  });
});

describe("PublicProfileSchema", () => {
  it("parsea la proyección pública con stats de asistencia", () => {
    const result = PublicProfileSchema.parse({
      userId: "uid1",
      username: "rudyx28",
      nameSurname: "Ruben Campuzano",
      teamname: "Spartans",
      role: "COACH",
      streak: 3,
      maxStreak: 5,
      attendanceRate: 80,
    });
    expect(result.streak).toBe(3);
  });

  it("las stats de asistencia son opcionales (usuario sin equipo)", () => {
    const result = PublicProfileSchema.parse({ userId: "uid1", role: "PLAYER" });
    expect(result.streak).toBeUndefined();
  });
});

describe("NotificationSchema", () => {
  it("parsea una notificación válida", () => {
    const result = NotificationSchema.parse({
      id: "n1",
      type: "attendance",
      title: "Asistencia",
      message: "Confirma tu asistencia",
      timestamp: 1_753_000_000_000,
      read: false,
    });
    expect(result.type).toBe("attendance");
  });

  it("un type desconocido cae a 'general' en vez de fallar (catch)", () => {
    const result = NotificationSchema.parse({ id: "n1", type: "tipo-legacy-desconocido" });
    expect(result.type).toBe("general");
  });

  it("title/message/timestamp/read ausentes caen a sus defaults", () => {
    const result = NotificationSchema.parse({ id: "n1", type: "general" });
    expect(result.title).toBe("");
    expect(result.message).toBe("");
    expect(result.timestamp).toBe(0);
    expect(result.read).toBe(false);
  });

  it("id es obligatorio — sin catch, falla si falta", () => {
    expect(NotificationSchema.safeParse({ type: "general" }).success).toBe(false);
  });
});
