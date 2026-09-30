import { describe, expect, it } from "vitest";
import { extractLinks, isVideoSite, linkLabel, splitLinks } from "./linkify";

describe("splitLinks", () => {
  it("texto sin URLs queda igual", () => {
    expect(splitLinks("Grupos de 3.\nSin enlaces")).toEqual([{ type: "text", value: "Grupos de 3.\nSin enlaces" }]);
  });

  it("enlace de YouTube tras un salto de línea", () => {
    const parts = splitLinks("Referencias:\nhttps://www.youtube.com/watch?v=-5p8zWGMUB8&t=318s");
    expect(parts).toEqual([
      { type: "text", value: "Referencias:\n" },
      {
        type: "link",
        url: "https://www.youtube.com/watch?v=-5p8zWGMUB8&t=318s",
        label: "youtube.com/watch",
      },
    ]);
  });

  it("la puntuación final no forma parte del enlace", () => {
    const parts = splitLinks("Ver https://youtu.be/abcdefghijk. Y seguir");
    expect(parts).toEqual([
      { type: "text", value: "Ver " },
      { type: "link", url: "https://youtu.be/abcdefghijk", label: "youtu.be/abcdefghijk" },
      { type: "text", value: ". Y seguir" },
    ]);
  });

  it("varias URLs", () => {
    const parts = splitLinks("a https://x.com/1 b http://y.com/2");
    expect(parts.filter((p) => p.type === "link").map((p) => p.type === "link" && p.url)).toEqual([
      "https://x.com/1",
      "http://y.com/2",
    ]);
  });

  it("javascript: no se enlaza", () => {
    expect(splitLinks("javascript:alert(1)")).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
  });
});

describe("linkLabel", () => {
  it("recorta las URLs largas de Instagram", () => {
    const label = linkLabel("https://www.instagram.com/reel/Cx-1sixtlOa/?igshid=NmQ4MjZlMjE5YQ==");
    expect(label).toBe("instagram.com/reel/Cx-1sixtlOa/");
    expect(linkLabel("https://example.com/" + "a".repeat(80)).length).toBe(40);
  });
});

describe("isVideoSite", () => {
  it("YouTube e Instagram sí, otros no", () => {
    expect(isVideoSite("https://youtu.be/x")).toBe(true);
    expect(isVideoSite("https://m.youtube.com/watch?v=x")).toBe(true);
    expect(isVideoSite("https://www.instagram.com/reel/x/")).toBe(true);
    expect(isVideoSite("https://example.com")).toBe(false);
    expect(isVideoSite("no es url")).toBe(false);
  });
});

describe("extractLinks", () => {
  it("sin repetir y en orden", () => {
    expect(extractLinks("https://a.com x https://b.com y https://a.com")).toEqual(["https://a.com", "https://b.com"]);
    expect(extractLinks(null)).toEqual([]);
  });
});
