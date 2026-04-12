/**
 * Ingress envelope guard for `mtw.ephemera.objects` (api.ephemera **Objects Change**).
 * Canonical guard and `sendObjectsChange` live in `../apiEphemera.ts`.
 */
export { isEphemeraApiObjectsChangeEnvelope } from '../apiEphemera'
export type { ObjectsChangeCommand } from '../localApiEvents'
