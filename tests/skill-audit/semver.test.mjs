import { test } from "node:test";
import assert from "node:assert/strict";

import {
  semverParts,
  semverCompare,
  maxSemver,
  isNonRegistrySpec,
} from "../../skills/encrypt-solana-prealpha/scripts/lib/semver.mjs";

test("semverParts strips leading v and parses main/pre", () => {
  assert.deepEqual(semverParts("v1.2.3"), { nums: [1, 2, 3], pre: "" });
  assert.deepEqual(semverParts("0.4.0-alpha.7"), {
    nums: [0, 4, 0],
    pre: "alpha.7",
  });
  assert.deepEqual(semverParts("1").nums, [1, 0, 0]);
});

test("semverCompare orders majors then minors then patches", () => {
  assert.ok(semverCompare("1.0.0", "2.0.0") < 0);
  assert.ok(semverCompare("2.0.0", "1.9.9") > 0);
  assert.equal(semverCompare("1.2.3", "1.2.3"), 0);
  assert.ok(semverCompare("1.2.3", "1.2.4") < 0);
});

test("semverCompare treats prerelease as lower than release", () => {
  assert.ok(semverCompare("1.0.0-alpha", "1.0.0") < 0);
  assert.ok(semverCompare("1.0.0", "1.0.0-alpha") > 0);
  assert.ok(semverCompare("1.0.0-alpha", "1.0.0-beta") < 0);
});

test("maxSemver returns the largest version", () => {
  assert.equal(maxSemver(["0.1.0", "0.2.0", "0.1.5"]), "0.2.0");
  assert.equal(maxSemver(["1.0.0-alpha", "1.0.0"]), "1.0.0");
  assert.equal(maxSemver([]), null);
});

test("isNonRegistrySpec rejects non-registry specs", () => {
  assert.ok(isNonRegistrySpec("workspace:*"));
  assert.ok(isNonRegistrySpec("file:../foo"));
  assert.ok(isNonRegistrySpec("link:../foo"));
  assert.ok(isNonRegistrySpec("git+https://github.com/x/y"));
  assert.ok(isNonRegistrySpec("http://registry/x"));
  assert.ok(isNonRegistrySpec("https://registry/x"));
  assert.ok(isNonRegistrySpec("*"));
  assert.ok(isNonRegistrySpec(""));
  assert.ok(isNonRegistrySpec(null));
});

test("isNonRegistrySpec accepts plain ranges", () => {
  assert.equal(isNonRegistrySpec("^0.1.0"), false);
  assert.equal(isNonRegistrySpec("~1.2.3"), false);
  assert.equal(isNonRegistrySpec("1.0.0"), false);
  assert.equal(isNonRegistrySpec(">=0.4.0"), false);
});
