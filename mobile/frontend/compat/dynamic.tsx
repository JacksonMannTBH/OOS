import { lazy, Suspense, type ComponentType } from "react";

export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>, options?: { ssr?: boolean; loading?: ComponentType }) {
  const Component = lazy(async () => {
    const loaded = await loader();
    return typeof loaded === "function" ? { default: loaded } : loaded;
  });
  // React's lazy type carries optional ref props; these map components use
  // ordinary props and keep the same public component contract.
  const Loaded = Component as unknown as ComponentType<P>;
  const Loading = options?.loading;
  return function DynamicComponent(props: P) {
    return <Suspense fallback={Loading ? <Loading /> : null}><Loaded {...props} /></Suspense>;
  };
}
