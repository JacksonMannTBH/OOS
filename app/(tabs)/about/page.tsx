import { SettingsBackLink } from "@/components/SettingsBackLink";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "About",
  description: "Take back your liberty",
};

const ABOUT_INTRO_HTML = `
<p>Most drivers notice patrol cars before they notice aircraft. Yet law enforcement agencies can also observe roads from thousands of feet overhead. Aircraft cover large areas, follow traffic across multiple roadways, and help ground crews maintain visual contact over long distances. Out Of Sight makes this activity easier to see by bringing publicly reported aircraft positions into one map.</p>

<p>Patrol planes combine speed with the endurance to cover several counties during a flight. Helicopters can hover, circle a smaller area, support rescue teams, and remain over a scene. Their missions range from traffic observation to searches and emergency response. The aircraft type, crew, equipment, and fuel load all shape how an operation unfolds.</p>

<p>Some aircraft carry <strong>FLIR</strong>, a thermal camera system that detects heat. Alongside stabilized cameras, zoom lenses, radios, searchlights, and video links, this equipment helps crews observe a scene and coordinate with teams on the ground. See an example of <a href="https://www.youtube.com/watch?v=3HdVoR9SFVE" target="_blank" rel="noopener noreferrer"><strong>FLIR</strong> in action</a>.</p>

<p>Every reported position, tail number, and flight path adds context to what is happening overhead. Out Of Sight brings those signals together so you can follow tracked aircraft, understand their movements, and stay aware of the skies around you.</p>
`;

const ABOUT_CLOSING_HTML = `
<p>LLC</p>
`;

export default function AboutPage() {
  return (
    <main
      className="ss-page-narrow"
      style={{
        minHeight: "100dvh",
        padding: "32px 18px 180px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <SettingsBackLink />
      <h1
        style={{
          margin: 0,
          color: SS_TOKENS.fg0,
          fontSize: "clamp(38px, 11vw, 72px)",
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        Take back your liberty
      </h1>

      <style>{`
        .ss-about-patrol {
          width: 100%;
          max-width: 840px;
          color: var(--ss-fg1);
          font-family: inherit;
          font-size: 15px;
          line-height: 1.65;
          text-align: left;
        }

        .ss-about-patrol p {
          margin: 0 0 18px;
        }

        .ss-about-patrol a {
          color: var(--ss-alert);
          font-weight: 700;
        }
      `}</style>

      <section className="ss-about-patrol">
        <div dangerouslySetInnerHTML={{ __html: ABOUT_INTRO_HTML }} />
        <div dangerouslySetInnerHTML={{ __html: ABOUT_CLOSING_HTML }} />
      </section>
    </main>
  );
}
