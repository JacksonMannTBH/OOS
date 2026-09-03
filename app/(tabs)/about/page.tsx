import { SettingsBackLink } from "@/components/SettingsBackLink";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "About",
  description: "Take back your liberty",
};

const ABOUT_INTRO_HTML = `
<p>Most drivers never look up. While people focus on patrol cars parked along the shoulder or hidden in the median, some of the most effective traffic enforcement platforms in Washington State operate thousands of feet overhead. Aircraft can cover vast stretches of highway in minutes, observe traffic patterns far beyond the view of any single officer, and maintain visual contact with vehicles long after they disappear from ground units. Unlike traditional patrol methods, aviation assets can monitor multiple roadways simultaneously, making them one of the most powerful &mdash; and often least noticed &mdash; tools available to law enforcement agencies.</p>

<p>What makes these aircraft especially effective is their combination of speed, endurance, and technology. A fixed-wing patrol aircraft can move across counties at highway-crushing speeds while remaining airborne for hours at a time. Helicopters trade some of that long-range endurance for the ability to hover, orbit tight areas, insert rescue teams, and stay directly over a scene. That is the part most people miss: these are not quick flybys. With the right fuel load, crew, and mission profile, they can stay in the air long enough to turn a normal night into a long-running aerial operation.</p>

<p>Adding to that capability is <strong>FLIR</strong> &mdash; forward-looking infrared / thermal-imaging technology commonly listed in public aircraft documents as FLIR. This equipment sees heat, not just light. Darkness, tree lines, distance, and poor visibility do not hide activity the way people assume they do. Combined with stabilized optics, high-powered zoom, GPS-referenced tracking, radios, searchlights, and live video downlinks, these aircraft become moving observation posts overhead. Watch an example here: <a href="https://www.youtube.com/watch?v=3HdVoR9SFVE" target="_blank" rel="noopener noreferrer"><strong>FLIR</strong> in action</a>.</p>

<p>As aerial surveillance technology continues to evolve, Washington&rsquo;s skies are becoming increasingly populated by platforms capable of seeing more, tracking longer, and covering far greater distances than many residents realize. Every orbit, transponder signal, tail number, and call sign tells part of the story. For those paying attention, the sky is no longer empty &mdash; it is part of the patrol grid.</p>
`;

const ABOUT_CLOSING_HTML = `
<p>I'm not looking to create more criminals. This a fuck you to the policy makers that killed my friend by implementing a panopticon around our hobby. Stay out of sight and stay safe.</p>

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
