#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packages = [
  "packages/saga-core/package.json",
  "packages/saga-nestjs/package.json",
  "packages/saga-transport-kafka/package.json",
];

const version = process.argv[2];

if (!version) {
  const current = JSON.parse(
    readFileSync(resolve(rootDir, packages[0]), "utf-8"),
  ).version;
  console.error(`Current version: ${current}`);
  console.error("");
  console.error("Usage: node scripts/bump-version.mjs <version>");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/bump-version.mjs 0.0.1-beta.1");
  console.error("  node scripts/bump-version.mjs 0.1.0");
  console.error("  node scripts/bump-version.mjs patch");
  console.error("  node scripts/bump-version.mjs minor");
  console.error("  node scripts/bump-version.mjs major");
  console.error("  node scripts/bump-version.mjs prepatch --preid beta");
  console.error("  node scripts/bump-version.mjs preminor --preid beta");
  console.error("  node scripts/bump-version.mjs prerelease --preid beta");
  process.exit(1);
}

const preidFlagIndex = process.argv.indexOf("--preid");
const preid = preidFlagIndex !== -1 ? process.argv[preidFlagIndex + 1] : "beta";

function parseVersion(versionString) {
  const preMatch = versionString.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)\.(\d+))?$/,
  );
  if (!preMatch) {
    return null;
  }
  return {
    major: parseInt(preMatch[1], 10),
    minor: parseInt(preMatch[2], 10),
    patch: parseInt(preMatch[3], 10),
    preTag: preMatch[4] || null,
    preNumber: preMatch[5] !== undefined ? parseInt(preMatch[5], 10) : null,
  };
}

function formatVersion(parsed) {
  let result = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (parsed.preTag !== null) {
    result += `-${parsed.preTag}.${parsed.preNumber}`;
  }
  return result;
}

function bumpVersion(current, bumpType, preIdentifier) {
  const parsed = parseVersion(current);
  if (!parsed) {
    console.error(`Cannot parse current version: ${current}`);
    process.exit(1);
  }

  switch (bumpType) {
    case "major":
      return formatVersion({
        major: parsed.major + 1,
        minor: 0,
        patch: 0,
        preTag: null,
        preNumber: null,
      });
    case "minor":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor + 1,
        patch: 0,
        preTag: null,
        preNumber: null,
      });
    case "patch":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.preTag ? parsed.patch : parsed.patch + 1,
        preTag: null,
        preNumber: null,
      });
    case "premajor":
      return formatVersion({
        major: parsed.major + 1,
        minor: 0,
        patch: 0,
        preTag: preIdentifier,
        preNumber: 0,
      });
    case "preminor":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor + 1,
        patch: 0,
        preTag: preIdentifier,
        preNumber: 0,
      });
    case "prepatch":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch + 1,
        preTag: preIdentifier,
        preNumber: 0,
      });
    case "prerelease":
      if (parsed.preTag === preIdentifier) {
        return formatVersion({ ...parsed, preNumber: parsed.preNumber + 1 });
      }
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch + 1,
        preTag: preIdentifier,
        preNumber: 0,
      });
    default:
      return null;
  }
}

const currentVersion = JSON.parse(
  readFileSync(resolve(rootDir, packages[0]), "utf-8"),
).version;
const bumpTypes = [
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
];
const newVersion = bumpTypes.includes(version)
  ? bumpVersion(currentVersion, version, preid)
  : version;

if (!newVersion || !parseVersion(newVersion)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}

for (const packagePath of packages) {
  const fullPath = resolve(rootDir, packagePath);
  const packageJson = JSON.parse(readFileSync(fullPath, "utf-8"));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  writeFileSync(fullPath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`  ${packageJson.name}: ${oldVersion} → ${newVersion}`);
}

console.log("");
console.log(`To publish, run:`);
console.log(
  `  git add -A && git commit -m "chore: bump version to ${newVersion}"`,
);
console.log(`  git tag v${newVersion}`);
console.log(`  git push origin main --tags`);
