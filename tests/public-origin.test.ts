/** Redirects must use the address people visit, not the internal one behind a proxy (Render). */
import { afterEach, describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/public-origin";

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
const appUrl = process.env.APP_URL;

afterEach(() => {
  if (appUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = appUrl;
});

describe("publicOrigin", () => {
  it("uses the proxy's forwarded host and protocol", () => {
    const r = req("http://localhost:10000/auth/callback", {
      "x-forwarded-host": "placeholder-ab12.onrender.com",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(r)).toBe("https://placeholder-ab12.onrender.com");
  });

  it("takes the first value when the headers list several hops", () => {
    const r = req("http://localhost:10000/", { "x-forwarded-host": "a.example.com, b.internal", "x-forwarded-proto": "https,http" });
    expect(publicOrigin(r)).toBe("https://a.example.com");
  });

  it("falls back to APP_URL when the request looks internal", () => {
    process.env.APP_URL = "https://placeholder-ab12.onrender.com/";
    expect(publicOrigin(req("http://localhost:10000/auth/callback"))).toBe("https://placeholder-ab12.onrender.com");
  });

  it("keeps a real origin as it is (e.g. a phone on the LAN)", () => {
    process.env.APP_URL = "https://placeholder-ab12.onrender.com";
    expect(publicOrigin(req("http://10.180.246.139:3000/login"))).toBe("http://10.180.246.139:3000");
  });
});
