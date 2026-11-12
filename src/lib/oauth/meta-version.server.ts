/** Explicit, shared Graph API version for OAuth, publishing and insight collection.
 * v24.0 support window checked at developers.facebook.com/docs/graph-api/changelog/versions/ on 2026-11-12.
 * Changing it requires provider contract tests and authorized external homologation.
 */
export function metaGraphVersion() {
  const version = process.env.META_GRAPH_VERSION ?? "v24.0";
  if (!/^v\d{2}\.0$/.test(version)) throw new Error("Invalid META_GRAPH_VERSION");
  return version;
}
export function metaGraphBase() {
  return `https://graph.facebook.com/${metaGraphVersion()}`;
}
