import type { AppStateId } from "./app-states";
import type { FleetEntry, FleetRole } from "./types";

export type OpsAircraft = {
  stateId: AppStateId;
  tail: string;
  model: string;
  unit: string;
  fuelText?: string;
  speedText: string;
  enduranceText: string;
  durationMin: number;
};

type WaAircraftTuple = [
  tail: string,
  model: string,
  unit: string,
  speedText: string,
  enduranceText: string,
  durationMin: number,
];

type LocalAircraftTuple = [
  stateId: AppStateId,
  tail: string,
  model: string,
  unit: string,
  fuelText: string,
  speedText: string,
  enduranceText: string,
  durationMin: number,
];

type AircraftTuple = [
  stateId: AppStateId,
  tail: string,
  model: string,
  unit: string,
  speedText: string,
  enduranceText: string,
  durationMin: number,
];

const WA_ROWS: WaAircraftTuple[] = [
  ["N102LP", "Cessna 182T Skylane", "WSP", "145 ktas / 167 mph", "Approx. 6.0 hours", 360],
  ["N207HB", "Beechcraft King Air B200", "State of WA", "290 kts / 334 mph", "Approx. 5.4-7.0 hours, depending on cruise setting", 372],
  ["N2446X", "Cessna 206H Stationair", "WSP", "142 kts / 163 mph", "Approx. 5.4 hours range-derived; WSP mission profile often listed at 6-8 hours", 420],
  ["N305DK", "Cessna 206H Stationair", "WSP", "142 kts / 163 mph", "Approx. 5.4 hours range-derived; WSP mission profile often listed at 6-8 hours", 420],
  ["N305RC", "Cessna 182T Skylane", "WSP", "145 ktas / 167 mph", "Approx. 6.0 hours", 360],
  ["N3532K", "Cessna 182T Skylane", "WSP historical", "145 ktas / 167 mph", "Approx. 6.0 hours by aircraft type", 360],
  ["N407KS", "Bell 407", "KCSO", "133 kts / 153 mph max cruise", "Approx. 4.0 hours", 240],
  ["N411KS", "Bell 206B JetRanger", "KCSO former", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N67817", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N67880", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N78906", "Bell 206B / TH-67A type", "KCSO", "118 kts / 136 mph", "Approx. 3.0-3.3 hours range-derived", 189],
  ["N790RJ", "Bell UH-1H Huey", "KCSO", "117 kts / 135 mph", "Approx. 2.5 hours range-derived", 150],
  ["N815SC", "Bell UH-1H Huey", "Snohomish SO", "117 kts / 135 mph", "Approx. 2.5 hours range-derived", 150],
  ["N9446P", "Cessna T206H Turbo Stationair", "Pierce SO", "161 ktas / 185 mph", "Approx. 4.4-5.0 hours range-derived", 282],
  ["N422CT", "Bell 407 / 407GXi", "KCSO", "133 kts / 153 mph max cruise", "Approx. 4.0 hours", 240],
];

const WA: OpsAircraft[] = WA_ROWS.map(
  ([tail, model, unit, speedText, enduranceText, durationMin]) => ({
    stateId: "washington",
    tail,
    model,
    unit,
    speedText,
    enduranceText,
    durationMin,
  }),
);

const NEW_ROW_DATA: AircraftTuple[] = [
  ["california","N976HP","Airbus AS350B3 / H125","CHP H14 / Northern Division, Redding","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N511HP","Cessna T206H Turbo Stationair","CHP Air11 / Northern Division, Redding","~161 kt","~4 hr 45 min",285],
  ["california","N159HP","GippsAero GA8 TC-320 Airvan","CHP Air13 / Northern Division, Redding","~130 kt","~6 hr 30 min",390],
  ["california","N617HP","Eurocopter AS350B3","CHP H1 / Headquarters helicopter, McClellan","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N974HP","Airbus AS350B3 / H125","CHP H20 / Valley Division, Auburn","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N978HP","Airbus AS350B3 / H125","CHP H24 / Valley Division, Auburn","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N202HP","Cessna 208B Grand Caravan","CHP Air21 / Valley Division, Auburn","~185 kt","~5 hr 00 min",300],
  ["california","N153HP","GippsAero GA8 TC-320 Airvan","CHP Air23 / Valley Division, Auburn","~130 kt","~6 hr 30 min",390],
  ["california","N981HP","Airbus AS350B3 / H125","CHP H30 / Golden Gate Division, Napa","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N982HP","Airbus AS350B3 / H125","CHP H32 / Golden Gate Division, Napa","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N137HP","GippsAero GA8 TC-320 Airvan","CHP Air37 / Golden Gate Division, Napa","~130 kt","~6 hr 30 min",390],
  ["california","N975HP","Airbus AS350B3 / H125","CHP H40 / Central Division, Fresno","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N986HP","Airbus AS350B3 / H125","CHP H42 / Central Division, Fresno","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N156HP","GippsAero GA8 TC-320 Airvan","CHP Air41 / Central Division, Fresno","~130 kt","~6 hr 30 min",390],
  ["california","N139HP","GippsAero GA8 TC-320 Airvan","CHP Air43 / Central Division, Fresno","~130 kt","~6 hr 30 min",390],
  ["california","N983HP","Airbus AS350B3 / H125","CHP H70 / Coastal Division, Paso Robles","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N443HP","Cessna T206H Turbo Stationair","CHP Air71 / Coastal Division, Paso Robles","~161 kt","~4 hr 45 min",285],
  ["california","N553HP","Cessna T206H Turbo Stationair","CHP Air73 / Coastal Division, Paso Robles","~161 kt","~4 hr 45 min",285],
  ["california","N984HP","Airbus AS350B3 / H125","CHP H80 / Inland Division, Apple Valley","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N985HP","Airbus AS350B3 / H125","CHP H82 / Inland Division, Apple Valley","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N441HP","Cessna T206H Turbo Stationair","CHP Air81 / Inland Division, Apple Valley","~161 kt","~4 hr 45 min",285],
  ["california","N513HP","Cessna T206H Turbo Stationair","CHP Air83 / Inland Division, Apple Valley","~161 kt","~4 hr 45 min",285],
  ["california","N979HP","Airbus AS350B3 / H125","CHP H58 / Southern Division, Fullerton","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N140HP","GippsAero GA8 TC-320 Airvan","CHP Air51 / Southern Division, Fullerton","~130 kt","~6 hr 30 min",390],
  ["california","N988HP","Airbus AS350B3 / H125","CHP H60 / Border Division, Thermal","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["california","N661HP","Cessna T206H Turbo Stationair","CHP Air61 / Border Division, Thermal","~161 kt","~4 hr 45 min",285],
  ["california","N551HP","Cessna T206H Turbo Stationair","CHP Air63 / Border Division, Thermal","~161 kt","~4 hr 45 min",285],
  ["texas","N60TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N90TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N124TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N204TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N405TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N702TX","Airbus AS350B2","Texas DPS","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["texas","N227TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N2374F","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N329TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N361TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N674TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N819TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N824TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N827TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N844TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N929TX","Airbus AS350B3 / H125","Texas DPS","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["texas","N145TX","MBB / Airbus BK117 C-2 / EC145","Texas DPS","~133 kt","~3 hr 30 min",210],
  ["texas","N1727L","Cessna T206H Turbo Stationair","Texas DPS","~161 kt","~4 hr 45 min",285],
  ["texas","N5271B","Cessna T206H Turbo Stationair","Texas DPS","~161 kt","~4 hr 45 min",285],
  ["texas","N219TX","Pilatus PC-12/47E","Texas DPS","~290 kt","~7 hr 00 min",420],
  ["texas","N243TX","Pilatus PC-12/47E","Texas DPS","~290 kt","~7 hr 00 min",420],
  ["texas","N430TX","Cessna 208 Caravan","Texas DPS","~186 kt","~5 hr 30 min",330],
  ["texas","N956TX","Cessna 208 Caravan","Texas DPS","~186 kt","~5 hr 30 min",330],
  ["texas","N968TX","Cessna 208 Caravan","Texas DPS","~186 kt","~5 hr 30 min",330],
  ["florida","N25HP","Cessna 182T Skylane","Florida Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["florida","N611HP","Cessna 182T Skylane","Florida Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["florida","N267HP","Cessna 172S Skyhawk","Florida Highway Patrol","~124 kt","~5 hr 00 min",300],
  ["florida","N610HP","Cessna 172RG Cutlass RG","Florida Highway Patrol","~144 kt","~5 hr 00 min",300],
  ["florida","N706HP","Cessna R182 Skylane RG","Florida Highway Patrol","~150-187 kt, depending source/config","~5 hr 00 min",300],
  ["florida","N531HP","Cessna T206H Turbo Stationair","Florida Highway Patrol","~161 kt","~4 hr 45 min",285],
  ["florida","N773HP","Cessna T206H Turbo Stationair","Florida Highway Patrol","~161 kt","~4 hr 45 min",285],
  ["ohio","N6HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N12HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N17HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N18HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N19HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N113HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N514HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N716HP","Cessna 182T Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N311HP","Cessna 182S Skylane","Ohio State Highway Patrol","~145 kt","~5 hr 30 min",330],
  ["ohio","N71HP","Airbus AS350B2","Ohio State Highway Patrol","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["ohio","N73HP","Airbus AS350B2","Ohio State Highway Patrol","~155 kt Vne / ~133 kt fast cruise","~4 hr 00 min",240],
  ["ohio","N72HP","Airbus H125","Ohio State Highway Patrol","~155 kt Vne / ~136 kt fast cruise","~4 hr 00 min",240],
  ["colorado","N202SP","Cessna T182T Turbo Skylane","Colorado State Patrol","~165 kt","~4 hr 45 min",285],
  ["colorado","N203SP","Cessna T182T Turbo Skylane","Colorado State Patrol","~165 kt","~4 hr 45 min",285],
  ["colorado","N201SP","Pilatus PC-12/47E","Colorado State Patrol","~290 kt","~7 hr 00 min",420],
];

const LOCAL_ROW_DATA: LocalAircraftTuple[] = [
  // California
  ["california", "N408DC", "Kodiak 100", "City of San Jose / Police Department", "320 gal", "174 ktas", "~9 hr 54 min", 594],
  ["california", "N408PD", "Airbus AS350B3 / H125", "City of San Jose / Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N220PD", "McDonnell Douglas 369E", "City of Oakland / Police Department Helicopter Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N330PD", "Schweizer 269C-1", "City of Oakland / Police Department Helicopter Unit", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N510PD", "McDonnell Douglas 369E", "City of Oakland / Police Department Helicopter Unit", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N407CC", "Bell 407", "Contra Costa County", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N408CC", "Bell 407", "Contra Costa County", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N175JC", "Socata TBM 700", "Sacramento County Sheriff's Office", "290 gal", "300 kt", "~5 hr 00 min", 300],
  ["california", "N255SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N266SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N277SD", "Eurocopter EC120B", "Sacramento County Sheriff's Office", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N774FL", "Cessna T206H", "Sacramento County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N911GC", "Bell UH-1H", "Sacramento County Sheriff's Office", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911RY", "Bell UH-1H", "Sacramento County Sheriff's Office", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N920FC", "MD Helicopters 369FF", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "~136 kt", "~2 hr 30 min", 150],
  ["california", "N921SD", "McDonnell Douglas 369E", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N922SD", "McDonnell Douglas 369E", "Fresno County Sheriff / County of Fresno", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N514JD", "Eurocopter EC120B", "City of Fresno", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N524MW", "Eurocopter EC120B", "City of Fresno", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["california", "N534PD", "Airbus AS350B3 / H125", "City of Fresno / Fresno Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N189JC", "Textron Aviation / Cessna T206H", "Tulare County Sheriff", "87 gal", "~161 ktas", "~4 hr 45 min", 285],
  ["california", "N297E", "Hughes 369E", "Kern County Sheriff's Department / County of Kern", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N35438", "Cessna T206H", "Kern County Sheriff's Department", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N397E", "Bell OH-58A", "Kern County Sheriff's Department", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N497E", "Bell OH-58A", "Kern County Sheriff's Department", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["california", "N597E", "Bell UH-1H", "Kern County Sheriff's Department / County of Kern", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911KC", "Rockwell International 690A", "Kern County Sheriff's Department / County of Kern", "~384 gal", "~283 kt", "~4 hr 30 min", 270],
  ["california", "N912KC", "Airbus AS350B3", "Kern County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N913KC", "Airbus AS350B3", "Kern County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N737ZA", "Cessna 172N", "County of Santa Cruz", "53 gal total / 50 gal usable", "163 kt", "~7 hr 54 min", 474],
  ["california", "N991YC", "Bell OH-58A", "City of Sacramento", "~70 gal", "129 kt", "~2 hr 00 min", 120],

  // Southern California local agencies
  ["california", "N213PF", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N221LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N223LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N224LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N225LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N226LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N228LA", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N230LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N232LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N233LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N267LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N472LA", "Airbus AS350B3 / H125", "Los Angeles Police Department / LAPD Air Support Division", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N665PD", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N913WB", "Eurocopter AS350B2", "Los Angeles Police Department / LAPD Air Support Division", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N104RC", "McDonnell Douglas 369E", "Los Angeles County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N535JP", "McDonnell Douglas 369E", "Los Angeles County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N6330C", "Cessna 210N", "Los Angeles County Sheriff's Department", "90 gal", "174 kt", "~5 hr 15 min", 315],
  ["california", "N732WQ", "Cessna T210M", "Los Angeles County Sheriff's Department", "90 gal", "~205 kt", "~5 hr 00 min", 300],
  ["california", "N950JE", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N950LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N951LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N951LB", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N952JH", "Airbus / Eurocopter AS332L1", "Los Angeles County Sheriff's Department / County of Los Angeles", "~370 gal", "~150 kt max / ~140 kt cruise", "~4 hr 00 min", 240],
  ["california", "N953LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N954LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N955LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N956LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N957LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N958LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N959LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N960LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N961LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N961SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N962LA", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N963SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N966SD", "Eurocopter AS350B2", "Los Angeles County Sheriff's Department / County of Los Angeles", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N166PD", "Robinson R66", "City of Fontana", "73.6 gal", "120 kt", "~3 hr 42 min", 222],
  ["california", "N462PD", "Robinson R66", "City of Fontana", "73.6 gal", "120 kt", "~3 hr 42 min", 222],
  ["california", "N641EG", "American Eurocopter AS350B2", "City of Fontana", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N226PD", "Eurocopter AS350B2", "Anaheim Police Department", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N28LB", "Eurocopter AS350B2", "City of Long Beach", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N29LB", "Eurocopter AS350B2", "City of Long Beach", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["california", "N9495F", "Hughes 269B", "City of Long Beach", "32 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N9549F", "Hughes 269B", "City of Long Beach", "32 gal", "95 kt", "~3 hr 30 min", 210],
  ["california", "N165PW", "GippsAero GA8 TC-320", "San Bernardino County Sheriff's Department", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N214SB", "Beech A200", "San Bernardino County Sheriff's Department", "549 gal", "~289 kt", "~5 hr 00 min", 300],
  ["california", "N265PW", "GippsAero GA8 TC-320", "San Bernardino County Sheriff's Department", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N305SB", "Bell UH-1H", "San Bernardino County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N307SB", "Bell 212", "San Bernardino County Sheriff's Department", "215 gal", "130 kt Vmo", "~3 hr 30 min", 210],
  ["california", "N308SB", "Bell 412EP", "San Bernardino County Sheriff's Department", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N309SB", "Bell UH-1H", "San Bernardino County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N625SB", "MD Helicopters 600N", "San Bernardino County Sheriff's Department", "116.2 gal", "135 kt", "~3 hr 00 min", 180],
  ["california", "N631SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N803SB", "McDonnell Douglas 369E", "San Bernardino County Sheriff's Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["california", "N831SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N832SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N833SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N834SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N835SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N836SB", "Airbus AS350B3", "San Bernardino County Sheriff's Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N313DP", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N319MW", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N670PC", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N709WG", "Bell 407", "San Diego County Sheriff's Department", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["california", "N989RL", "Bell 412EP", "San Diego County Sheriff's Department", "331 gal standard", "126 kt", "~3 hr 48 min", 228],
  ["california", "N881SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N882SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N883SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N884SD", "Airbus AS350B3", "City of San Diego / Police Air Support Unit", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N181SD", "Bell UH-1H", "Orange County Sheriff's Department / RNSP", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N183SD", "Airbus AS350B3", "Orange County Sheriff's Department / RNSP", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N185SD", "Airbus AS350B3", "Orange County Sheriff's Department / RNSP", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["california", "N186SD", "Bell UH-1H", "Orange County Sheriff's Department / RNSP", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N6045C", "Cessna T206H", "Orange County Sheriff's Department / RNSP", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["california", "N960RN", "GippsAero GA8 TC-320", "Orange County Sheriff's Department / RNSP", "~87.7 gal", "~130 kt", "~8 hr 12 min", 492],
  ["california", "N893RC", "Pilatus PC-12/47E", "Riverside County Sheriff's Office", "2,704 lb / ~402 gal", "290 ktas", "~7 hr 00 min", 420],
  ["california", "N205SD", "Bell HH-1H", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N205VC", "Bell 205B", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N206VC", "Bell 206L-1", "Ventura County Sheriff's Department", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["california", "N32240", "Bell 205A-1", "Ventura County Sheriff's Department", "209 gal", "120 kt", "~2 hr 24 min", 144],
  ["california", "N911VC", "Bell 206L-3", "Ventura County Sheriff's Department", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["california", "N371DM", "American Champion 8GCBC", "City of Bakersfield", "72 gal / 70 gal usable", "122 kt / 140 mph", "~7 hr 30 min", 450],
  ["california", "N47PS", "Cessna 182P", "City of Palm Springs", "92 gal", "~150 kt", "~6 hr 40 min", 400],

  // Texas
  ["texas", "N1576F", "McDonnell Douglas 369E", "City of Houston Police Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N8372F", "McDonnell Douglas 369E", "City of Houston Police Department", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["texas", "N9298F", "Hughes 269C", "City of Houston Police Department", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N9686F", "Hughes 269C", "City of Houston Police Department", "~41 gal", "95 kt", "~3 hr 30 min", 210],
  ["texas", "N125AP", "Airbus AS350B3", "Austin Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N21475", "Cessna 182P", "Austin Police Department", "92 gal", "~150 kt", "~6 hr 40 min", 400],
  ["texas", "N6227", "Airbus AS350B3", "Austin Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N67662", "Bell 206B", "Austin Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N917FW", "Bell 206B", "Fort Worth Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N911FW", "Bell 505", "Fort Worth Police Department", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["texas", "N206FW", "Bell 206B", "Fort Worth Police Department", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["texas", "N505FW", "Bell 505", "Fort Worth Police Department", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["texas", "N111NK", "Airbus AS350B3", "San Antonio Police Department", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N820PM", "Eurocopter EC120B", "San Antonio Police Department", "110 gal", "125 kt", "~4 hr 32 min", 272],
  ["texas", "N312SD", "Airbus AS350B3", "Harris County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["texas", "N731SD", "Bell OH-58A", "Harris County Sheriff's Office", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["texas", "N915SD", "Bell OH-58A", "Harris County Sheriff's Office", "~70 gal", "129 kt", "~2 hr 00 min", 120],

  // Florida
  ["florida", "N71LC", "Airbus / Eurocopter AS350B3", "Lee County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N72LC", "Airbus / Eurocopter AS350B2", "Lee County Sheriff's Office", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N73LC", "Airbus / Eurocopter AS350B3", "Lee County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N74LC", "Cessna T210L", "Lee County Sheriff's Office", "90 gal", "~205 kt", "~5 hr 00 min", 300],
  ["florida", "N407KB", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N407LM", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N407NL", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N481RC", "Bell 206L-3", "Orange County Sheriff's Office", "98-111 gal", "110 kt", "~3 hr 00 min", 180],
  ["florida", "N552CH", "Bell 407", "Orange County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N866DM", "Cessna T206H", "Orange County Sheriff's Office", "87 gal", "161 ktas", "~4 hr 45 min", 285],
  ["florida", "N103JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N311JP", "Bell OH-58A", "Jacksonville Sheriff's Office / City of Jacksonville", "~70 gal", "129 kt", "~2 hr 00 min", 120],
  ["florida", "N312JP", "Bell 206B", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N313JP", "Bell 206B-III / MD 369E", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal if Bell 206B-III / ~60 gal if MD 369E", "120 kt if Bell / 136 kt if MD 369E", "~3 hr 00 min if Bell / ~2 hr 30 min if MD", 180],
  ["florida", "N314JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N317JP", "Bell 206B", "Jacksonville Sheriff's Office / City of Jacksonville", "91 gal", "120 kt", "~3 hr 00 min", 180],
  ["florida", "N92JP", "Bell 407", "Jacksonville Sheriff's Office / City of Jacksonville", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N109BC", "Eurocopter EC135T1", "Broward County Sheriff's Office", "179 gal standard / 232 gal max with aux", "141 kt", "~3 hr 36 min", 216],
  ["florida", "N257BC", "Eurocopter EC135T2+", "Broward County Sheriff's Office", "179 gal standard / 232 gal max with aux", "141 kt", "~3 hr 36 min", 216],
  ["florida", "N265BC", "Airbus MBB-BK117 D-3 / H145", "Broward County Sheriff's Office", "242 gal / 1,649 lb", "143 kt", "~3 hr 35 min", 215],
  ["florida", "N268BC", "Airbus MBB-BK117 D-3 / H145", "Broward County Sheriff's Office", "242 gal / 1,649 lb", "143 kt", "~3 hr 35 min", 215],
  ["florida", "N781BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N782BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N783BC", "Airbus AS350B3", "Broward County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N101TN", "Textron Aviation 208 / Cessna 208 Caravan", "Hillsborough County Sheriff's Office", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["florida", "N227ND", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N245HC", "Pilatus PC-12/47E", "Hillsborough County Sheriff's Office", "2,704 lb / ~402 gal", "290 ktas", "~7 hr 00 min", 420],
  ["florida", "N413JM", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N717CD", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N911DG", "Airbus AS350B3", "Hillsborough County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N1SD", "Airbus AS350B2", "Pinellas County Sheriff's Office / Pinellas County", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N2SD", "Eurocopter AS350B2", "Pinellas County Sheriff's Office / Pinellas County", "143 gal", "155 kt max / ~133 kt fast cruise", "~4 hr 00 min", 240],
  ["florida", "N43SD", "Airbus AS350B3", "Pinellas County Sheriff's Office / Pinellas County", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N14806", "Airbus AS350B3", "Pinellas County Sheriff's Office / Pinellas County", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N58501", "Cessna 208B", "Pinellas County Sheriff's Office / Pinellas County", "332 gal", "185 ktas", "~5 hr 20 min", 320],
  ["florida", "N518DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N618DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N718DS", "Bell 407", "Volusia Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N401H", "Bell 407", "St. Johns County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N506MC", "Bell 407", "Manatee County Sheriff's Office", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
  ["florida", "N175SC", "Airbus H125 / AS350B3-type", "Seminole County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N176SC", "Airbus H125 / AS350B3-type", "Seminole County Sheriff's Office", "143 gal / 937 lb", "155 kt max / 136 kt fast cruise", "~4 hr 27 min", 267],
  ["florida", "N401MP", "Cessna P210N", "Miami-Dade Police Department", "90 gal", "204 kt", "~5 hr 00 min", 300],
  ["florida", "N772GJ", "Kodiak 100", "Polk County Sheriff's Office", "320 gal", "174 ktas", "~9 hr 54 min", 594],

  // Ohio
  ["ohio", "N551CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N552CP", "Bell 505", "City of Columbus / Division of Police", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["ohio", "N553CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N556CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N557CP", "MD Helicopters 369FF", "City of Columbus / Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N559CP", "Bell 505", "City of Columbus / Division of Police", "84.85 gal standard / 104.85 gal with aux", "133 kt", "~4 hr 30 min with aux", 270],
  ["ohio", "N951CP", "McDonnell Douglas 369E", "City of Cleveland / Cleveland Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],
  ["ohio", "N952CP", "McDonnell Douglas 369E", "City of Cleveland / Cleveland Division of Police", "403 lb / ~60 gal", "136 kt", "~2 hr 30 min", 150],

  // Colorado
  ["colorado", "N720DP", "Bell 407", "City and County of Denver / Denver Police", "127.8 gal standard / 146.8 gal with aux", "133 kt max cruise", "~4 hr 35 min with aux", 275],
];

const NEW_ROWS: OpsAircraft[] = NEW_ROW_DATA.map(
  ([stateId, tail, model, unit, speedText, enduranceText, durationMin]) => ({
    stateId,
    tail,
    model,
    unit,
    speedText,
    enduranceText,
    durationMin,
  }),
);

const LOCAL_ROWS: OpsAircraft[] = LOCAL_ROW_DATA.map(
  ([
    stateId,
    tail,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin,
  ]) => ({
    stateId,
    tail,
    model,
    unit,
    fuelText,
    speedText,
    enduranceText,
    durationMin,
  }),
);

export const OPS_AIRCRAFT: OpsAircraft[] = [...WA, ...NEW_ROWS, ...LOCAL_ROWS];

const OPS_AIRCRAFT_STATE_BY_TAIL = new Map(
  OPS_AIRCRAFT.map((row) => [row.tail, row.stateId]),
);

export function stateIdForOpsAircraftTail(
  tail: string,
): AppStateId | null {
  return OPS_AIRCRAFT_STATE_BY_TAIL.get(tail.trim().toUpperCase()) ?? null;
}

export function filterOpsAircraftByState<T extends { tail: string }>(
  aircraft: T[],
  stateId: AppStateId,
): T[] {
  return aircraft.filter((aircraft) => {
    const explicitStateId = (aircraft as { stateId?: AppStateId }).stateId;
    if (explicitStateId) return explicitStateId === stateId;
    return stateIdForOpsAircraftTail(aircraft.tail) === stateId;
  });
}

export const ADDITIONAL_TRACKED_TAILS = [...NEW_ROWS, ...LOCAL_ROWS].map(
  (row) => row.tail,
);

export const AIRCRAFT_DURATION_MINUTES = Object.fromEntries(
  OPS_AIRCRAFT.map((row) => [row.tail, row.durationMin]),
) as Record<string, number>;

export const ADDITIONAL_FLEET: FleetEntry[] = [
  ...NEW_ROWS.map((row) => {
    const role = roleForModel(row.model);
    const operator = operatorForState(row.stateId);
    return {
      tail: row.tail,
      hex: null,
      operator,
      model: row.model,
      nickname: callSignFromUnit(row.unit),
      roleDescription: "Traffic enforcement",
      base: row.unit,
      role,
      roleConfidence: "tentative",
      roleNote: `${operator} traffic enforcement aircraft`,
    } satisfies FleetEntry;
  }),
  ...LOCAL_ROWS.map((row) => {
    const role = roleForModel(row.model);
    return {
      tail: row.tail,
      hex: null,
      operator: row.unit,
      model: row.model,
      nickname: null,
      roleDescription:
        role === "patrol"
          ? "Patrol / air support"
          : "Law enforcement / surveillance",
      base: row.unit,
      role,
      roleConfidence: "tentative",
      roleNote: `${row.unit} local agency aircraft`,
    } satisfies FleetEntry;
  }),
];

function operatorForState(stateId: OpsAircraft["stateId"]): string {
  switch (stateId) {
    case "california":
      return "CHP";
    case "texas":
      return "Texas DPS";
    case "florida":
      return "Florida Highway Patrol";
    case "ohio":
      return "Ohio State Highway Patrol";
    case "colorado":
      return "Colorado State Patrol";
    default:
      return "WSP";
  }
}

function callSignFromUnit(unit: string): string | null {
  if (!unit.includes("/")) return null;
  const first = unit.split("/")[0]?.trim();
  return first || null;
}

function roleForModel(model: string): FleetRole {
  return /\b(airbus|eurocopter|as350|h125|h145|ec120|ec135|ec145|bk117|bell|mcdonnell douglas|md helicopters|md 369|369e|369ff|hughes|robinson|r66|uh-1|oh-58|helicopter)\b/i.test(
    model,
  )
    ? "patrol"
    : "fixed_wing";
}
