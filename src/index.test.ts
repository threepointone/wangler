import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock dotenv
vi.mock("dotenv", () => ({
  config: vi.fn((options?: { path?: string }) => {
    if (options?.path?.includes(".env.production")) {
      return {
        error: null,
        parsed: {
          API_URL: "https://prod.api.com",
          DEBUG: "false",
        },
      };
    }
    // Default .env file
    return {
      error: null,
      parsed: {
        API_URL: "https://default.api.com",
        DEBUG: "true",
        SECRET_KEY: "default-secret",
      },
    };
  }),
}));

// Mock child_process.spawn
vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      // console.log("spawn", event, callback);
      if (event === "exit") {
        // console.log("exit", callback);
        // callback(0);
      }
    }),
  })),
}));

// Mock path.resolve to return a predictable path
vi.mock("path", () => ({
  resolve: vi.fn(() => "/mock/path/to/wrangler.js"),
  dirname: vi.fn(),
  basename: vi.fn(),
}));

describe("wangler", () => {
  const originalEnv = process.env;
  const originalArgv = process.argv;
  let fullCommand: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  async function importAndGetCommand() {
    const module = await import("./index.js");
    return module.fullCommand;
  }

  test("basic dev command", async () => {
    process.argv = ["node", "wangler", "dev"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("wrangler.js dev");
  });

  test("basic deploy command", async () => {
    process.argv = ["node", "wangler", "deploy"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("wrangler.js deploy");
  });

  test("--penv with key:value sets environment variable", async () => {
    process.argv = ["node", "wangler", "dev", "--penv", "API_KEY:123"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("--define process.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain("--define import.meta.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain('--var API_KEY:"123"');
  });

  test("--penv with just key reads from process.env", async () => {
    process.env.TEST_KEY = "test-value";
    process.argv = ["node", "wangler", "dev", "--penv", "TEST_KEY"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain(
      "--define process.env.TEST_KEY:'\"test-value\"'"
    );
    expect(fullCommand).toContain(
      "--define import.meta.env.TEST_KEY:'\"test-value\"'"
    );
    expect(fullCommand).toContain('--var TEST_KEY:"test-value"');
  });

  test("--penv with missing process.env key shows warning", async () => {
    const consoleSpy = vi.spyOn(console, "warn");
    process.argv = ["node", "wangler", "dev", "--penv", "NONEXISTENT_KEY"];
    fullCommand = await importAndGetCommand();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Warning: Environment variable NONEXISTENT_KEY not found in process.env"
    );
  });

  test("combines multiple sources of environment variables", async () => {
    process.env.TEST_KEY = "from-process";
    process.argv = [
      "node",
      "wangler",
      "dev",
      "--env",
      "production",
      "--penv",
      "API_KEY:123",
      "--penv",
      "TEST_KEY",
    ];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("--define process.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain("--define import.meta.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain(
      "--define process.env.TEST_KEY:'\"from-process\"'"
    );
    expect(fullCommand).toContain(
      "--define import.meta.env.TEST_KEY:'\"from-process\"'"
    );
    expect(fullCommand).toContain('--var TEST_KEY:"from-process"');

    expect(fullCommand).toContain(
      "--define import.meta.env.API_URL:'\"https://prod.api.com\"'"
    );
    expect(fullCommand).toContain('--var API_URL:"https://prod.api.com"');
    expect(fullCommand).toContain("--define process.env.DEBUG:'\"false\"'");
    expect(fullCommand).toContain("--define import.meta.env.DEBUG:'\"false\"'");
    expect(fullCommand).toContain('--var DEBUG:"false"');
  });

  test("passes through additional wrangler arguments", async () => {
    process.argv = [
      "node",
      "wangler",
      "dev",
      "--port",
      "8787",
      "--local",
      "--penv",
      "API_KEY:123",
    ];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("--port 8787 --local");
    expect(fullCommand).toContain("--define process.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain("--define import.meta.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain('--var API_KEY:"123"');
  });

  test("handles multiple --penv flags", async () => {
    process.argv = [
      "node",
      "wangler",
      "dev",
      "--penv",
      "API_KEY:123",
      "--penv",
      "DEBUG:true",
      "--penv",
      "ENV:prod",
    ];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("--define process.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain("--define import.meta.env.API_KEY:'\"123\"'");
    expect(fullCommand).toContain('--var API_KEY:"123"');
    expect(fullCommand).toContain("--define process.env.DEBUG:'\"true\"'");
    expect(fullCommand).toContain("--define import.meta.env.DEBUG:'\"true\"'");
    expect(fullCommand).toContain('--var DEBUG:"true"');
    expect(fullCommand).toContain("--define process.env.ENV:'\"prod\"'");
    expect(fullCommand).toContain("--define import.meta.env.ENV:'\"prod\"'");
    expect(fullCommand).toContain('--var ENV:"prod"');
  });

  test("--penv overrides env files", async () => {
    process.argv = [
      "node",
      "wangler",
      "dev",
      "--env",
      "production",
      "--penv",
      "API_URL:override-value",
    ];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain(
      "--define process.env.API_URL:'\"override-value\"'"
    );
    expect(fullCommand).toContain(
      "--define import.meta.env.API_URL:'\"override-value\"'"
    );
    expect(fullCommand).toContain('--var API_URL:"override-value"');
  });
});

describe("Command passthrough", () => {
  const originalArgv = process.argv;
  let fullCommand: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.argv = originalArgv;
  });

  async function importAndGetCommand() {
    const module = await import("./index.js");
    return module.fullCommand;
  }

  test("should pass through non-dev/deploy commands directly to wrangler", async () => {
    process.argv = ["node", "script.js", "whoami", "--some-flag"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toBe(
      "node /mock/path/to/wrangler.js whoami --some-flag"
    );
  });

  test("should not pass through dev command", async () => {
    process.argv = ["node", "script.js", "dev", "--some-flag"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("dev");
    expect(fullCommand).toContain("--some-flag");
    expect(fullCommand).not.toBe(
      "node /mock/path/to/wrangler.js dev --some-flag"
    );
    expect(fullCommand).toContain("--define process.env"); // Should include env processing
  });

  test("should not pass through deploy command", async () => {
    process.argv = ["node", "script.js", "deploy", "--some-flag"];
    fullCommand = await importAndGetCommand();
    expect(fullCommand).toContain("deploy");
    expect(fullCommand).toContain("--some-flag");
    expect(fullCommand).not.toBe(
      "node /mock/path/to/wrangler.js deploy --some-flag"
    );
    expect(fullCommand).toContain("--define process.env"); // Should include env processing
  });
});

// Helper function to extract the actual command that would be run
function extractDefineArgs(envVars: Record<string, string>): string {
  function isValidJSIdentifier(str: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
  }

  return Object.entries(envVars)
    .map(([key, value]) => {
      const processEnvAccess = isValidJSIdentifier(key)
        ? `process.env.${key}`
        : `process.env["${key}"]`;
      const importMetaAccess = isValidJSIdentifier(key)
        ? `import.meta.env.${key}`
        : `import.meta.env["${key}"]`;
      return `--define ${processEnvAccess}:\'${JSON.stringify(
        value
      )}\' --define ${importMetaAccess}:\'${JSON.stringify(
        value
      )}\' --var ${key}:${JSON.stringify(value)}`;
    })
    .join(" ");
}

describe("Environment Variable Handling", () => {
  it("should handle standard environment variable names correctly", () => {
    const envVars = {
      NORMAL_VAR: "value1",
      ANOTHER_VAR: "value2",
    };

    const defineArgs = extractDefineArgs(envVars);

    expect(defineArgs).toContain("process.env.NORMAL_VAR");
    expect(defineArgs).toContain("import.meta.env.NORMAL_VAR");
    expect(defineArgs).toContain("process.env.ANOTHER_VAR");
    expect(defineArgs).toContain("import.meta.env.ANOTHER_VAR");
    expect(defineArgs).not.toContain('process.env["NORMAL_VAR"]');
  });

  it("should handle environment variables with special characters correctly", () => {
    const envVars = {
      "my-special-var": "value1",
      "another-var": "value2",
      "123invalid": "value3",
    };

    const defineArgs = extractDefineArgs(envVars);

    expect(defineArgs).toContain('process.env["my-special-var"]');
    expect(defineArgs).toContain('import.meta.env["my-special-var"]');
    expect(defineArgs).toContain('process.env["another-var"]');
    expect(defineArgs).toContain('process.env["123invalid"]');
    expect(defineArgs).not.toContain("process.env.my-special-var");
  });

  it("should handle mixed standard and special character variables", () => {
    const envVars = {
      NORMAL_VAR: "value1",
      "special-var": "value2",
      _VALID_VAR: "value3",
      $valid: "value4",
    };

    const defineArgs = extractDefineArgs(envVars);

    expect(defineArgs).toContain("process.env.NORMAL_VAR");
    expect(defineArgs).toContain('process.env["special-var"]');
    expect(defineArgs).toContain("process.env._VALID_VAR");
    expect(defineArgs).toContain("process.env.$valid");
    expect(defineArgs).not.toContain('process.env["NORMAL_VAR"]');
    expect(defineArgs).not.toContain("process.env.special-var");
  });

  it("should properly escape values in JSON stringification", () => {
    const envVars = {
      NORMAL_VAR: 'value with "quotes"',
      "special-var": "value with 'single' quotes",
    };

    const defineArgs = extractDefineArgs(envVars);

    expect(defineArgs).toContain('"value with \\"quotes\\""');
    expect(defineArgs).toContain("\"value with 'single' quotes\"");
  });
});
