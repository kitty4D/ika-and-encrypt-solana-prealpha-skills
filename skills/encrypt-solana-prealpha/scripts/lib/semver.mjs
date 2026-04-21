/**
 * Minimal semver comparator — extracted verbatim from the audit script so it can be
 * unit-tested. Covers the subset the audit actually needs: leading `v`, `-prerelease`,
 * numeric major.minor.patch comparison. Build metadata (`+foo`) is ignored.
 */

export function semverParts(v) {
  const s = String(v).replace(/^v/i, "").trim();
  const dash = s.indexOf("-");
  const main = dash >= 0 ? s.slice(0, dash) : s;
  const pre = dash >= 0 ? s.slice(dash + 1) : "";
  const nums = main.split(".").map((x) => {
    const n = parseInt(String(x).replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  });
  while (nums.length < 3) nums.push(0);
  return { nums: nums.slice(0, 3), pre };
}

/** negative if a < b, 0 if equal, positive if a > b */
export function semverCompare(a, b) {
  const A = semverParts(a);
  const B = semverParts(b);
  for (let i = 0; i < 3; i++) {
    if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  }
  if (!A.pre && B.pre) return 1;
  if (A.pre && !B.pre) return -1;
  if (!A.pre && !B.pre) return 0;
  return A.pre < B.pre ? -1 : A.pre > B.pre ? 1 : 0;
}

export function maxSemver(versions) {
  if (!versions.length) return null;
  let best = versions[0];
  for (let i = 1; i < versions.length; i++) {
    if (semverCompare(versions[i], best) > 0) best = versions[i];
  }
  return best;
}

export function isNonRegistrySpec(spec) {
  if (!spec || typeof spec !== "string") return true;
  const s = spec.trim();
  return (
    s.startsWith("workspace:") ||
    s.startsWith("file:") ||
    s.startsWith("link:") ||
    s.startsWith("git+") ||
    s.startsWith("http:") ||
    s.startsWith("https:") ||
    s === "*"
  );
}
