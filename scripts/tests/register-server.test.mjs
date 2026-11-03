import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerServer, validateRegistrationInput } from "../register-server.mjs";

const valid = (outputPath) => ({
  directoryUrl: "https://directory.example.test",
  registrationKey: "a-bootstrap-secret-that-is-long-enough",
  outputPath,
  server: {
    name: "Night City Test",
    description: "Registration test",
    address: "play.example.test",
    port: 30120,
    maxPlayers: 64,
    tags: ["roleplay", "english"],
    gameVersion: "2.31"
  }
});

test("registration validates transport security and server fields", () => {
  assert.throws(() => validateRegistrationInput({ ...valid("x"), directoryUrl: "http://directory.example.test" }), /HTTPS/);
  assert.throws(() => validateRegistrationInput({ ...valid("x"), directoryUrl: "http://localhost:8787" }), undefined);
  assert.throws(() => validateRegistrationInput({ ...valid("x"), server: { ...valid("x").server, port: 0 } }), /port/);
});

test("registration writes returned credentials to a private config without printing them", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cyberrp-register-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "host.json");
  const result = await registerServer(valid(outputPath), {
    fetcher: async (url, init) => {
      assert.equal(String(url), "https://directory.example.test/v1/servers");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.authorization, "Bearer a-bootstrap-secret-that-is-long-enough");
      return new Response(JSON.stringify({
        server: { id: "123e4567-e89b-42d3-a456-426614174000", name: "Night City Test" },
        credential: "one-time-host-credential-value-1234567890"
      }), { status: 201, headers: { "content-type": "application/json" } });
    }
  });
  const config = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(result.serverId, config.serverId);
  assert.equal(config.credential, "one-time-host-credential-value-1234567890");
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
});

test("registration refuses to overwrite an existing credential file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "cyberrp-register-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "host.json");
  await assert.rejects(registerServer(valid(outputPath), {
    fetcher: async () => new Response(JSON.stringify({
      server: { id: "123e4567-e89b-42d3-a456-426614174000" },
      credential: "one-time-host-credential-value-1234567890"
    }), { status: 201 })
  }));
});
