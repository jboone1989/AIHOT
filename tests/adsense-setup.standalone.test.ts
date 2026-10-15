import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { adsenseTxt, adsenseVerificationId, ADSENSE_SELLER_ID } from "@aihot/contracts/adsense";
import { isApiOwned } from "@aihot/contracts/http-policy";

const REAL_SHAPE_ID = "ca-pub-1234567890123456"; // Synthetic test fixture; NEVER used as production configuration.

test("verification is opt-in, requiring exactly a 16-digit publisher ID", () => {
  assert.equal(adsenseVerificationId({}), null);
  assert.equal(adsenseVerificationId({ ADSENSE_PUBLISHER_ID: REAL_SHAPE_ID }), null);
  assert.equal(adsenseVerificationId({ ADSENSE_VERIFICATION_ENABLED: "false", ADSENSE_PUBLISHER_ID: REAL_SHAPE_ID }), null);
  assert.equal(adsenseVerificationId({ ADSENSE_VERIFICATION_ENABLED: "TRUE", ADSENSE_PUBLISHER_ID: REAL_SHAPE_ID }), null);
  for (const id of ["", "ca-pub-xxx", "pub-1234567890123456", "ca-pub-123", "ca-pub-12345678901234567", "ca-pub-0000<script>"]) {
    assert.equal(adsenseVerificationId({ ADSENSE_VERIFICATION_ENABLED: "true", ADSENSE_PUBLISHER_ID: id }), null, id);
  }
  assert.equal(adsenseVerificationId({ ADSENSE_VERIFICATION_ENABLED: "true", ADSENSE_PUBLISHER_ID: REAL_SHAPE_ID }), REAL_SHAPE_ID);
});

test("authorized Google seller record is exact and valid", () => {
  assert.equal(adsenseTxt(REAL_SHAPE_ID), `google.com, pub-1234567890123456, DIRECT, ${ADSENSE_SELLER_ID}\n`);
  assert.throws(() => adsenseTxt("pub-1234567890123456"));
  assert.throws(() => adsenseTxt("ca-pub-<script>"));
});

test("ads.txt is served by the API, not the web SSR fallback", () => {
  assert.ok(isApiOwned("/ads.txt"));
  assert.equal(isApiOwned("/ads-txt"), false);
});

test("no ad script is wired to verification-only HTML", () => {
  const root=readFileSync(new URL("../apps/web/app/root.tsx", import.meta.url), "utf8");
  assert.ok(root.includes('name="google-adsense-account"'));
  assert.ok(!root.includes("adsbygoogle.js"));
  const config=readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  assert.ok(config.includes("ADSENSE_VERIFICATION_ENABLED=false"));
  assert.ok(!/^ADSENSE_PUBLISHER_ID=ca-pub-[0-9]{16}/m.test(config));
});
