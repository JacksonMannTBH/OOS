export type AircraftVehicleType = "Helicopter" | "Plane";

const HELICOPTER_MODEL_PATTERN =
  /\b(airbus|eurocopter|as350|h125|h135|h145|ec120|ec130|ec135|ec145|bk117|mbb|bell|mcdonnell douglas|md helicopters|md\s?(?:369|500|520|530|600)|369e|369ff|500n|600n|hughes|schweizer|robinson|r44|r66|jet\s?ranger|iroquois|huey|dolphin|uh-1|uh-60|hh-1|oh-58|th-57|th-67|sikorsky|s-70|agusta|leonardo)\b/i;

export function aircraftVehicleType(
  model: string | null | undefined,
): AircraftVehicleType {
  if (!model) return "Plane";
  return HELICOPTER_MODEL_PATTERN.test(model) ? "Helicopter" : "Plane";
}
