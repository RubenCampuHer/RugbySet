import { describe, expect, it } from "vitest";
import { matchOutcome, normalizeVideoUrl, parseScore, scoreline, youtubeId } from "./match";
import type { Match } from "./types";

const played = (f: number | null, a: number | null, home: boolean | null = true): Match =>
  ({ status: "played", pointsFor: f, pointsAgainst: a, home, videos: {} }) as Match;

describe("match", () => {
  it("matchOutcome solo con partido jugado y los dos marcadores", () => {
    expect(matchOutcome(played(24, 10))).toBe("win");
    expect(matchOutcome(played(10, 10))).toBe("draw");
    expect(matchOutcome(played(3, 17))).toBe("loss");
    expect(matchOutcome(played(3, null))).toBeNull();
    expect(matchOutcome({ ...played(24, 10), status: "pending" })).toBeNull();
    expect(matchOutcome(null)).toBeNull();
  });

  it("scoreline pone primero al que juega en casa", () => {
    expect(scoreline(played(24, 10, true))).toBe("24 – 10");
    expect(scoreline(played(24, 10, false))).toBe("10 – 24");
    expect(scoreline(played(24, 10, null))).toBe("24 – 10");
    expect(scoreline(played(null, 10))).toBeNull();
  });

  it("parseScore", () => {
    expect(parseScore("")).toBeNull();
    expect(parseScore(" 7 ")).toBe(7);
    expect(parseScore("-1")).toBe("invalid");
    expect(parseScore("1.5")).toBe("invalid");
    expect(parseScore("1000")).toBe("invalid");
  });

  it("youtubeId reconoce los formatos habituales", () => {
    const id = "dQw4w9WgXcQ";
    expect(youtubeId(`https://www.youtube.com/watch?v=${id}&t=42s`)).toBe(id);
    expect(youtubeId(`https://youtu.be/${id}?si=abc`)).toBe(id);
    expect(youtubeId(`https://m.youtube.com/shorts/${id}`)).toBe(id);
    expect(youtubeId(`https://www.youtube.com/live/${id}`)).toBe(id);
    expect(youtubeId(`https://www.youtube-nocookie.com/embed/${id}`)).toBe(id);
    expect(youtubeId("https://vimeo.com/123456")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=corto")).toBeNull();
    expect(youtubeId("no es una url")).toBeNull();
  });

  it("normalizeVideoUrl solo admite http(s)", () => {
    expect(normalizeVideoUrl(" https://vimeo.com/1 ")).toBe("https://vimeo.com/1");
    expect(normalizeVideoUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeVideoUrl("vimeo.com/1")).toBeNull();
  });
});
