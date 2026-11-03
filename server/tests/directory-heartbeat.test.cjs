const assert = require("node:assert/strict");
const test = require("node:test");
const { DirectoryHeartbeatAgent } = require("../../dist-server/server/src/host/directory-heartbeat.js");

test("heartbeat agent sends the server credential and authoritative player count", async () => {
  const calls = [];
  const agent = new DirectoryHeartbeatAgent({
    directoryUrl: "https://directory.example.test",
    serverId: "123e4567-e89b-42d3-a456-426614174000",
    credential: "host-secret",
    getPlayerCount: () => 7,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    }
  });

  await agent.heartbeatNow();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://directory.example.test/v1/servers/123e4567-e89b-42d3-a456-426614174000/heartbeat");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.authorization, "Bearer host-secret");
  assert.deepEqual(JSON.parse(calls[0].init.body), { playerCount: 7 });
});

test("heartbeat agent rejects insecure remote URLs and invalid player counts", async () => {
  assert.throws(() => new DirectoryHeartbeatAgent({
    directoryUrl: "http://directory.example.test",
    serverId: "123e4567-e89b-42d3-a456-426614174000",
    credential: "host-secret",
    getPlayerCount: () => 0
  }), /HTTPS/);

  const agent = new DirectoryHeartbeatAgent({
    directoryUrl: "http://127.0.0.1:8787",
    serverId: "123e4567-e89b-42d3-a456-426614174000",
    credential: "host-secret",
    getPlayerCount: () => 10001,
    fetcher: async () => { throw new Error("fetch must not run"); }
  });
  await assert.rejects(agent.heartbeatNow(), /invalid player count/);
});

test("heartbeat agent unregisters with DELETE and treats missing records as absent", async () => {
  const methods = [];
  const agent = new DirectoryHeartbeatAgent({
    directoryUrl: "http://localhost:8787",
    serverId: "123e4567-e89b-42d3-a456-426614174000",
    credential: "host-secret",
    getPlayerCount: () => 0,
    fetcher: async (_url, init) => {
      methods.push(init.method);
      return new Response("{}", { status: 404 });
    }
  });
  assert.equal(await agent.unregister(), false);
  assert.deepEqual(methods, ["DELETE"]);
});
