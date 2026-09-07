import { LogoMark } from "./brand/Logo";

export function DataLoadingScreen({
  asOverlay = false,
}: {
  asOverlay?: boolean;
}) {
  const RootElement = asOverlay ? "div" : "main";

  return (
    <RootElement
      className="ss-data-loading"
      aria-busy="true"
      aria-live="polite"
      role={asOverlay ? "status" : undefined}
    >
      <div className="ss-data-loading__visual" aria-hidden="true">
        <span className="ss-data-loading__orbit ss-data-loading__orbit--outer" />
        <span className="ss-data-loading__orbit ss-data-loading__orbit--inner" />
        <span className="ss-data-loading__sweep" />
        <span className="ss-data-loading__ping" />
        <LogoMark
          height={72}
          width={108}
          variant="open"
          className="ss-data-loading__logo"
        />
      </div>

      <div className="ss-data-loading__copy">
        <p className="ss-data-loading__eyebrow">Live aircraft watch</p>
        <h1>Updating the radar</h1>
      </div>

      <div className="ss-data-loading__progress" aria-hidden="true">
        <span />
      </div>
    </RootElement>
  );
}
