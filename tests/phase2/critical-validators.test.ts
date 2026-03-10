import test from "node:test";
import assert from "node:assert/strict";
import { validateLogPayload } from "../../lib/validators/logs";
import { validateMove } from "../../lib/validators/tank-movements";
import { validateHarvestPayload } from "../../lib/validators/harvest";

const objectId = "507f1f77bcf86cd799439011";
const objectId2 = "507f1f77bcf86cd799439012";

test("validateLogPayload accepts a valid daily log payload", () => {
  const result = validateLogPayload({
    batchId: objectId,
    feedSession: "morning",
    feedGiven: 2.5,
    mortality: 3,
    ph: 7.2,
    ammonia: 0.1,
    temperature: 28,
    waterChanged: true,
    waterChangePct: 25,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.batchId, objectId);
    assert.equal(result.value.waterChangePct, 25);
  }
});

test("validateLogPayload rejects waterChanged=true with 0 percent", () => {
  const result = validateLogPayload({
    batchId: objectId,
    waterChanged: true,
    waterChangePct: 0,
  });
  assert.equal(result.ok, false);
});

test("validateMove rejects same source and destination tank", () => {
  const result = validateMove({
    batchId: objectId,
    fromTankId: objectId,
    toTankId: objectId,
    count: 10,
  });
  assert.equal(result.ok, false);
});

test("validateMove accepts valid movement payload", () => {
  const result = validateMove({
    batchId: objectId,
    fromTankId: objectId,
    toTankId: objectId2,
    count: 35,
    reason: "sorting",
  });
  assert.equal(result.ok, true);
});

test("validateHarvestPayload rejects invalid channel", () => {
  const result = validateHarvestPayload({
    batchId: objectId,
    weightKg: 100,
    pricePerKg: 2000,
    channel: "invalid-channel",
  });
  assert.equal(result.ok, false);
});

test("validateHarvestPayload accepts valid harvest payload", () => {
  const result = validateHarvestPayload({
    batchId: objectId,
    fishSold: 200,
    weightKg: 120,
    pricePerKg: 2500,
    channel: "market",
    markBatchHarvested: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.channel, "market");
    assert.equal(result.value.markBatchHarvested, true);
  }
});

