declare module "*.webp" { const image: { src: string }; export default image; }
declare module "*?raw" { const content: string; export default content; }
declare module "*.module.css" { const classes: Record<string, string>; export default classes; }
