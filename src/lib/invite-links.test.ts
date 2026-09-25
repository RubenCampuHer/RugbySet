import { describe, expect, it } from "vitest";
import { clubInviteUrl, safeNext, teamCodeFromNext, teamInviteUrl } from "./invite-links";

const BASE = "https://rugbyset.web.app";

describe("invite-links", () => {
  it("enlaces de equipo y club codifican el código", () => {
    expect(teamInviteUrl("SP@", BASE)).toBe(`${BASE}/join?code=SP%40`);
    expect(clubInviteUrl("CLUB 1", BASE)).toBe(`${BASE}/join-club?code=CLUB+1`);
  });

  it("safeNext solo acepta rutas internas", () => {
    expect(safeNext("/join?code=X")).toBe("/join?code=X");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  it("teamCodeFromNext", () => {
    expect(teamCodeFromNext("/join?code=SP%40")).toBe("SP@");
    expect(teamCodeFromNext("/join-club?code=X")).toBeNull();
    expect(teamCodeFromNext(null)).toBeNull();
  });
});
