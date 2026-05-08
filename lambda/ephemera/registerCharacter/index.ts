import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"

// Phase 4 cutover: ephemera no longer holds session adjacency authority.
// Authoritative `registercharacter` ingress now lives in `lambda/connections`,
// and `Meta::Room.activeCharacters` plus arrival messaging are driven by the
// `mtw.ephemera.positions` DataSource (see `../dataSource/positions/`).
// This handler is intentionally a no-op while the matching messageBus
// subscription remains for compatibility; both are scheduled for removal in
// Phase 5 of `taskPlanning/lambda/connections/AGENT.characterSubDataSource.planning.md`.
export const registerCharacter = async (_params: { payloads: RegisterCharacterMessage[]; messageBus: MessageBus }): Promise<void> => {
}

export default registerCharacter
