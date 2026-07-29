import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Deterministic messageOrchestration slot ids for a navigate/home bundle. Independently derivable
 * by both the declarer (orchestrateNavigate.ts, positions side) and the reporters
 * (publishMembershipPresentation.ts, perception side; the characterMove branches in
 * dataSource/perception/orchestrate.ts) --- no further hand-off is needed beyond sharing bundleId.
 * Deliberately dependency-free to avoid a cycle between those two modules.
 */
export const navigateLeaveSlotId = (roomId: EphemeraRoomId): string => `leave:${roomId}`
export const NAVIGATE_ARRIVE_SLOT_ID = 'arrive'
export const NAVIGATE_HEADER_SLOT_ID = 'header'
