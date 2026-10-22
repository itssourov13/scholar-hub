import { describe, expect, test } from "vitest";
import { homeHref, isBnPath, isHomePath, routeLocale, toggleTarget } from "../i18n";

describe("routeLocale", () => {
  test("Bangla prefix is always bn", () => {
    expect(routeLocale("/bn")).toBe("bn");
    expect(routeLocale("/bn/")).toBe("bn");
    expect(routeLocale("/bn/scholarships")).toBe("bn");
  });

  test("English homepage follows stored preference rather than forcing en", () => {
    expect(routeLocale("/")).toBeNull();
  });

  test("non-localized pages defer to stored preference", () => {
    expect(routeLocale("/scholarships")).toBeNull();
    expect(routeLocale("/chat")).toBeNull();
  });
});

describe("homeHref", () => {
  test("Bangla preference lands on the localized homepage", () => {
    expect(homeHref("bn")).toBe("/bn");
    expect(homeHref("en")).toBe("/");
  });
});

describe("isHomePath", () => {
  test("treats both locale homepages as home", () => {
    expect(isHomePath("/")).toBe(true);
    expect(isHomePath("/bn")).toBe(true);
    expect(isHomePath("/bn/")).toBe(true);
    expect(isHomePath("/scholarships")).toBe(false);
  });
});

describe("toggleTarget", () => {
  test("homepage round-trips between / and /bn", () => {
    expect(toggleTarget("/")).toEqual({ href: "/bn", locale: "bn" });
    expect(toggleTarget("/bn")).toEqual({ href: "/", locale: "en" });
    expect(toggleTarget("/bn/")).toEqual({ href: "/", locale: "en" });
  });

  test("non-localized pages have no URL target", () => {
    expect(toggleTarget("/scholarships")).toBeNull();
    expect(toggleTarget("/guide/ielts")).toBeNull();
  });
});

describe("isBnPath", () => {
  test("matches the /bn prefix only", () => {
    expect(isBnPath("/bn")).toBe(true);
    expect(isBnPath("/bn/foo")).toBe(true);
    expect(isBnPath("/bng")).toBe(false);
    expect(isBnPath("/")).toBe(false);
  });
});
