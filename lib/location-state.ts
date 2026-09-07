import { isStateCode, type StateCode } from "@/lib/app-states";

type CensusState = { STUSAB?: unknown };
type CensusGeocoderResponse = {
  result?: {
    geographies?: {
      States?: CensusState[];
    };
  };
};

export function validCoordinates(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function stateCodeFromCensusResponse(
  payload: CensusGeocoderResponse,
): StateCode | null {
  const candidate = payload.result?.geographies?.States?.[0]?.STUSAB;
  return isStateCode(candidate)
    ? candidate.toUpperCase() as StateCode
    : null;
}
