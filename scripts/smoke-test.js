import { initDb } from "../src/services/db.js";
import { app, pool } from "../src/server.js";

const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function assertOk(name, condition, detail = "") {
  if (!condition) throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
  console.log(`ok - ${name}`);
}

try {
  await initDb(pool);

  const health = await request("/health");
  await assertOk("health endpoint", health.response.ok && health.data.ok);

  const readiness = await request("/readiness");
  await assertOk("readiness endpoint responds", [200, 503].includes(readiness.response.status));

  const stateRules = await request("/state-rules/CA");
  await assertOk("state rules endpoint", stateRules.response.ok && stateRules.data.state === "CA");

  const draft = await request("/intake-drafts", {
    method: "POST",
    body: JSON.stringify({
      email: "smoke-test@example.com",
      fullName: "Smoke Test",
      state: "CA",
      form: { goal: "smoke-test" },
      selectedClauses: ["successor-trustee"],
      source: "smoke_test"
    })
  });
  await assertOk("intake draft creation", draft.response.status === 201 && draft.data.draftId);

  const operations = await request("/operations-brief");
  await assertOk("operations brief", operations.response.ok && operations.data.scorecard);

  console.log("Living Trust API smoke test passed.");
} finally {
  server.close();
}
