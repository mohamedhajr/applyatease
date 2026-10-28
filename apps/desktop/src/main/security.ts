import { isAbsolute, relative, resolve } from "node:path";

export function isTrustedLocation(
  location: string,
  developmentUrl?: string,
): boolean {
  try {
    const url = new URL(location);
    if (developmentUrl) return url.origin === new URL(developmentUrl).origin;
    return (
      url.protocol === "app:" &&
      url.hostname === "app" &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

export function resolveAsset(
  root: string,
  location: string,
): string | undefined {
  if (!isTrustedLocation(location)) return undefined;
  try {
    const pathname = decodeURIComponent(new URL(location).pathname);
    if (pathname.includes("\\") || pathname.includes("\0")) return undefined;
    const file = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    const child = relative(root, file);
    if (child.startsWith("..") || isAbsolute(child)) return undefined;
    return file;
  } catch {
    return undefined;
  }
}
