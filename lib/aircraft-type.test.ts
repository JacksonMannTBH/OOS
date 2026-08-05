import assert from "node:assert";
import { test } from "node:test";
import { aircraftVehicleType } from "./aircraft-type";

test("public-safety helicopter models are classified as helicopters", () => {
  const helicopterModels = [
    "McDonnell Douglas 369E",
    "MD Helicopters 369FF",
    "MD Helicopters 500N",
    "Airbus AS350B3 / H125",
    "Airbus MBB-BK117 D-3 / H145",
    "Eurocopter EC120B",
    "Bell OH-58A",
    "Bell 206B / TH-67A Creek",
    "Robinson R66",
    "Schweizer 269C-1",
  ];

  for (const model of helicopterModels) {
    assert.equal(aircraftVehicleType(model), "Helicopter", model);
  }
});

test("fixed-wing models stay classified as planes", () => {
  const planeModels = [
    "Cessna 182T Skylane",
    "Cessna T206H Stationair",
    "Beechcraft B200 Super King Air",
    "Pilatus PC-12/45",
  ];

  for (const model of planeModels) {
    assert.equal(aircraftVehicleType(model), "Plane", model);
  }
});
