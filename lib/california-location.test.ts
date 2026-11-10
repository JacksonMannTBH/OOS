import assert from "node:assert/strict";
import test from "node:test";
import { californiaRegionForCoordinates } from "./california-location";

test("location follows the fleet's county boundary, including Central California", () => {
  const places: [string, number, number, "north" | "south"][] = [
    ["San Francisco", 37.7749, -122.4194, "north"],
    ["Sacramento", 38.5816, -121.4944, "north"],
    ["Redding", 40.5865, -122.3917, "north"],
    ["Fresno", 36.7378, -119.7871, "north"],
    ["San Luis Obispo", 35.2828, -120.6596, "north"],
    ["Nipomo", 35.0436, -120.4761, "north"],
    ["Earlimart", 35.8841, -119.2723, "north"],
    ["Bishop", 37.3614, -118.3997, "north"],
    ["Los Angeles", 34.0522, -118.2437, "south"],
    ["San Diego", 32.7157, -117.1611, "south"],
    ["Bakersfield", 35.3733, -119.0187, "south"],
    ["Delano", 35.7688, -119.2471, "south"],
    ["Santa Maria", 34.9530, -120.4357, "south"],
    ["Santa Barbara", 34.4208, -119.6982, "south"],
    ["Ventura", 34.2805, -119.2945, "south"],
    ["Palm Springs", 33.8303, -116.5453, "south"],
    ["El Centro", 32.792, -115.5631, "south"],
    ["Trona", 35.7627, -117.3714, "south"],
    ["Avalon, Catalina Island", 33.3428, -118.3287, "south"],
  ];
  for (const [name, lat, lon, region] of places) assert.equal(californiaRegionForCoordinates(lat, lon), region, name);
});

test("outside California and invalid locations leave the region unset", () => {
  for (const [lat, lon] of [[47.6062, -122.3321], [36.1699, -115.1398], [39.5296, -119.8138], [32.5149, -117.0382], [35.3733, -130], [NaN, -118], [34, Infinity]]) {
    assert.equal(californiaRegionForCoordinates(lat!, lon!), null, `${lat}, ${lon}`);
  }
});
