"use client";

import Link from "next/link";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { cardinalFromDeg } from "@/lib/ride-mode";
import type { Aircraft } from "@/lib/types";
import { HelicopterIcon } from "./HelicopterIcon";
import { PlaneIcon } from "./PlaneIcon";
import { Tooltip } from "./Tooltip";

export function HomeActiveAircraft({ aircraft, nearest, statusColor, mockParam }: {
  aircraft: Aircraft[];
  nearest?: { plane: Aircraft; distanceNm: number | null } | null;
  statusColor: string;
  mockParam?: string;
}) {
  const title = aircraft.length > 0 ? "Active Air Support" : "No Eyes";
  return <section className="ss-home-aircraft" aria-label={title}>
    <h1>{title}</h1>
    {aircraft.length > 0 && <nav aria-label="Active aircraft" className="ss-home-aircraft-scroll ss-scroll">
      <div className="ss-home-aircraft-track">
        {aircraft.map(plane => {
          const color = aircraftColorForTail(plane.tail);
          const name = plane.tail;
          const helicopter = plane.role === "patrol" || plane.role === "sar";
          return <Tooltip key={plane.tail} content={name}>
            <Link href={{ pathname: "/map", query: { tail: plane.tail, ...(mockParam ? { mock: mockParam } : {}) } }}
              prefetch={false} aria-label={`View ${name} on the map`} className="ss-home-aircraft-link">
              <span className="ss-home-aircraft-icon" aria-hidden="true" style={{
                color, borderColor: color, boxShadow: `0 0 0 3px ${color}1f, 0 10px 22px rgba(0, 0, 0, 0.28)`,
              }}>
                {helicopter ? <HelicopterIcon size={29} heading={plane.heading ?? 0} />
                  : <PlaneIcon size={23} role={plane.role} heading={plane.heading ?? 0} tone="radar" color={color} />}
              </span>
            </Link>
          </Tooltip>;
        })}
      </div>
    </nav>}
    {aircraft.length > 0 && nearest?.distanceNm != null && <NearestAircraftInformation
      plane={nearest.plane} distanceNm={nearest.distanceNm} statusColor={statusColor} mockParam={mockParam} />}
  </section>;
}

function NearestAircraftInformation({ plane, distanceNm, statusColor, mockParam }: { plane: Aircraft; distanceNm: number; statusColor: string; mockParam?: string }) {
  const speed = plane.ground_speed_kt;
  const heading = plane.heading;
  const type = plane.model ? aircraftVehicleType(plane.model)
    : plane.role === "patrol" || plane.role === "sar" ? "Helicopter" : "Plane";
  return <Link href={{ pathname: "/map", query: { tail: plane.tail, ...(mockParam ? { mock: mockParam } : {}) } }}
    prefetch={false} className="ss-home-aircraft-info-link" aria-label={`View ${plane.tail} on the map`}>
    <dl className="ss-home-aircraft-info" style={{ borderColor: statusColor }} aria-label={`Nearest aircraft ${plane.tail}`}>
    <div><dt className="sr-only">Aircraft type</dt><dd>{type}</dd></div>
    <div><dt className="sr-only">Distance away</dt><dd>{distanceNm.toFixed(1)} <small>nm</small></dd></div>
    <div><dt className="sr-only">Ground speed</dt><dd>{typeof speed === "number" && Number.isFinite(speed) && speed >= 0
      ? Math.round(speed) : "—"} <small>kt</small></dd></div>
    <div><dt className="sr-only">Heading</dt><dd>{typeof heading === "number" && Number.isFinite(heading)
      ? cardinalFromDeg(heading) : "—"}</dd></div>
    </dl>
  </Link>;
}
