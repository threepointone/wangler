#!/usr/bin/env node

import { spawn } from "child_process";
import { config, DotenvConfigOutput } from "dotenv";
import * as path from "path";

// Function to find --env value in args
function getEnvFromArgs(args: string[]): string | null {
  const envIndex = args.indexOf("--env");
  if (envIndex !== -1 && envIndex + 1 < args.length) {
    return args[envIndex + 1];
  }
  return null;
}

// Function to find --env-file value in args
function getEnvFilePath(args: string[]): string | null {
  const envFileIndex = args.indexOf("--env-file");
  if (envFileIndex !== -1 && envFileIndex + 1 < args.length) {
    return args[envFileIndex + 1];
  }
  return null;
}

// Function to extract --penv values and remove them from args
function extractPenvArgs(args: string[]): {
  envVars: Record<string, string>;
  remainingArgs: string[];
} {
  const envVars: Record<string, string> = {};
  const remainingArgs: string[] = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--penv" && i + 1 < args.length) {
      const keyValue = args[i + 1];
      const colonIndex = keyValue.indexOf(":");

      if (colonIndex !== -1) {
        // Handle key:value format
        const key = keyValue.slice(0, colonIndex);
        const value = keyValue.slice(colonIndex + 1);
        if (key && value) {
          envVars[key] = value;
        }
      } else {
        // Handle key-only format, read from process.env
        const value = process.env[keyValue];
        if (value !== undefined) {
          envVars[keyValue] = value;
        } else {
          console.warn(
            `Warning: Environment variable ${keyValue} not found in process.env`
          );
        }
      }
      i += 2; // Skip both the --penv and its value
    } else if (args[i] === "--env-file" && i + 1 < args.length) {
      i += 2; // Skip both --env-file and its value
    } else {
      remainingArgs.push(args[i]);
      i += 1;
    }
  }

  return { envVars, remainingArgs };
}

// Load environment variables from .env files
function loadEnvFiles(envName: string | null, customEnvPath: string | null) {
  let baseEnv: DotenvConfigOutput = { parsed: {} };

  // Load custom .env file if specified
  if (customEnvPath) {
    baseEnv = config({ path: customEnvPath });
    if (baseEnv.error) {
      console.warn(`Warning: Could not load env file at ${customEnvPath}`);
    } else {
      console.log(`Loaded environment variables from ${customEnvPath}`);
    }
  } else {
    // Load default .env file
    baseEnv = config();
    if (baseEnv.error) {
      // console.warn("Warning: No .env file found");
    }
  }

  let envSpecificVars = {};
  if (envName) {
    const envSpecificPath = customEnvPath
      ? `${path.dirname(customEnvPath)}/${path.basename(
          customEnvPath
        )}.${envName}`
      : `.env.${envName}`;

    const envSpecificConfig = config({ path: envSpecificPath });
    if (!envSpecificConfig.error) {
      envSpecificVars = envSpecificConfig.parsed || {};
      console.log(`Loaded environment variables from ${envSpecificPath}`);
    }
  }

  // Merge base env with environment-specific env, giving priority to environment-specific variables
  return {
    ...(baseEnv.parsed || {}),
    ...envSpecificVars,
  };
}

// Get the command (dev or deploy) and additional args
const [, , command, ...additionalArgs] = process.argv;

const wranglerPath = path.resolve(
  require.resolve("wrangler/package.json"),
  "../bin/wrangler.js"
);

// Pass all arguments directly to wrangler
export let fullCommand = `node ${wranglerPath} ${process.argv
  .slice(2)
  .join(" ")}`;

// If command is not dev or deploy, pass through to wrangler directly
if (
  !command ||
  (!["dev", "deploy"].includes(command) && command !== undefined)
) {
  const child = spawn(fullCommand, {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  // process.exit(0);
  // return;
} else {
  // Extract --penv arguments and remaining args
  const { envVars: penvVars, remainingArgs } = extractPenvArgs(additionalArgs);

  // Load environment variables based on --env and --env-file arguments
  const envName = getEnvFromArgs(remainingArgs);
  const customEnvPath = getEnvFilePath(additionalArgs);
  const dotenvVars = loadEnvFiles(envName, customEnvPath);

  // Merge all environment variables, with --penv taking highest priority
  const allEnvVars = {
    ...dotenvVars,
    ...penvVars,
  };

  // Convert environment variables to --define arguments
  const defineArgs = Object.entries(allEnvVars)
    .map(
      ([key, value]) =>
        `--define process.env.${key}:\'${JSON.stringify(value)}\'`
    )
    .join(" ");

  // Find the actual wrangler binary
  // const wranglerPath = path.resolve(
  //   require.resolve("wrangler/package.json"),
  //   "../bin/wrangler.js"
  // );

  // Construct the full command with remaining args
  fullCommand = `node ${wranglerPath} ${command} ${defineArgs} ${remainingArgs.join(
    " "
  )}`;

  // Execute wrangler with the environment variables
  const child = spawn(fullCommand, {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}
