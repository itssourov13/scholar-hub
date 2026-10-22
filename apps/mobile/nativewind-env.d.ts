/// <reference types="nativewind/types" />

// TypeScript 6 checks unresolved side-effect imports by default; NativeWind
// consumes this global stylesheet through Metro rather than TypeScript.
declare module "*.css";
