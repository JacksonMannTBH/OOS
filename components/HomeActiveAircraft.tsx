"use client";

import Link from "next/link";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import type { Aircraft } from "@/lib/types";
import { HelicopterIcon } from "./HelicopterIcon";
import { PlaneIcon } from "./PlaneIcon";
import { Tooltip } from "./Tooltip";

export function HomeActiveAircraft({ aircraft, mockParam }: { aircraft: Aircraft[]; mockParam?: string }) {
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
  </section>;
}
