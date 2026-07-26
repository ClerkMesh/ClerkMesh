#!/usr/bin/env node
import { spawn } from "node:child_process";
import { accessSync, constants, lstatSync, readFileSync, realpathSync } from "node:fs";
import { delimiter, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const clerkmeshRoot = realpathSync(resolve(moduleDir, "../../.."));
export const firstmateHome = realpathSync(resolve(clerkmeshRoot, "firstmate"));

const extensionPaths = Object.freeze([
  realpathSync(resolve(firstmateHome, ".pi/extensions/fm-primary-turnend-guard.ts")),
  realpathSync(resolve(firstmateHome, ".pi/extensions/fm-primary-pi-watch.ts")),
  realpathSync(resolve(clerkmeshRoot, "packages/pi-primary-extension/index.ts")),
]);

const canonicalEnvironment = Object.freeze({
  CLERKMESH_ROOT: clerkmeshRoot,
  CLERKMESH_DATA: resolve(clerkmeshRoot, "clerkmesh-data"),
  CLERKMESH_STATE: resolve(clerkmeshRoot, "clerkmesh-state"),
  CLERKMESH_CLERKS: resolve(clerkmeshRoot, "clerks"),
  CLERKMESH_CACHE: resolve(clerkmeshRoot, "cache"),
  FM_ROOT_OVERRIDE: firstmateHome,
  FM_HOME: firstmateHome,
});

function isDirectoryWithoutSymlink(path) {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function assertInitialized() {
  const marker = resolve(canonicalEnvironment.CLERKMESH_DATA, ".clerkmesh-version");
  let markerBytes = "";
  try {
    const stat = lstatSync(marker);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid marker");
    markerBytes = readFileSync(marker, "utf8");
  } catch {
    throw new Error("ClerkMesh is not initialized; run bin/clerkmesh init first");
  }
  if (markerBytes !== "1\n") {
    throw new Error("ClerkMesh initialized state is unsupported or malformed; run bin/clerkmesh init for details");
  }
  for (const path of Object.values(canonicalEnvironment)) {
    if (!isDirectoryWithoutSymlink(path)) {
      throw new Error(`ClerkMesh initialized state is incomplete or nonconforming: ${path}`);
    }
  }
}

function findExecutable(name) {
  if (name.includes("/")) throw new Error(`invalid executable name: ${name}`);
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory || !isAbsolute(directory)) continue;
    const candidate = resolve(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return realpathSync(candidate);
    } catch {
      // Keep searching PATH. The resolved executable is frozen in the launch spec.
    }
  }
  throw new Error(`required dependency not found: ${name}`);
}

export function buildPrimaryLaunch(mode) {
  if (mode !== "tui" && mode !== "rpc") throw new Error(`unsupported Primary mode: ${mode}`);
  assertInitialized();
  const commonArgv = [
    "--no-extensions",
    ...extensionPaths.flatMap((path) => ["-e", path]),
  ];
  if (process.env.CLERKMESH_GATE0_CERT === "1") {
    commonArgv.push(
      "--no-session",
      "--no-context-files",
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      "--approve",
      "--offline",
    );
  }
  const argv = mode === "rpc" ? [...commonArgv, "--mode", "rpc"] : commonArgv;
  const productBin = resolve(clerkmeshRoot, "node_modules/.bin");
  if (!isDirectoryWithoutSymlink(productBin)) {
    throw new Error("ClerkMesh runtime dependencies are unavailable; run corepack pnpm install --frozen-lockfile");
  }
  const env = {
    ...process.env,
    ...canonicalEnvironment,
    PATH: `${productBin}${delimiter}${process.env.PATH ?? ""}`,
    CLERKMESH_PRIMARY_MODE: mode,
  };
  const executable = findExecutable("pi");
  return Object.freeze({
    executable,
    argv: Object.freeze(argv),
    cwd: firstmateHome,
    env,
    report: Object.freeze({
      mode,
      cwd: firstmateHome,
      executable,
      argv: Object.freeze([...argv]),
      environment: canonicalEnvironment,
      extensions: extensionPaths,
      gate0Certification: process.env.CLERKMESH_GATE0_CERT === "1",
    }),
  });
}

export function spawnPrimary(mode, stdio) {
  const launch = buildPrimaryLaunch(mode);
  const child = spawn(launch.executable, launch.argv, {
    cwd: launch.cwd,
    env: launch.env,
    stdio,
  });
  return { child, launch };
}

async function runTui() {
  const { child, launch } = spawnPrimary("tui", "inherit");
  await new Promise((resolveStarted, rejectStarted) => {
    child.once("spawn", resolveStarted);
    child.once("error", rejectStarted);
  });
  process.stderr.write(`CLERKMESH_PRIMARY_LAUNCHED mode=tui pid=${child.pid} cwd=${launch.cwd}\n`);

  let forwardedSignal = null;
  const forward = (signal) => {
    forwardedSignal = signal;
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, () => forward(signal));

  const result = await new Promise((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  if (result.signal || forwardedSignal) process.exitCode = 128;
  else process.exitCode = result.code ?? 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== "tui") {
    console.error("error: usage: primary-launch.mjs tui");
    process.exit(1);
  }
  runTui().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
}
