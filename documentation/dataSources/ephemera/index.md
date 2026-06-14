# Ephemera Data Source

## Stream

**Source**: mtw.ephemera

Events:

- Asset Cached
- Asset Decached
- Component State Update [To Be Implemented]
- Character Navigate (mtw.ephemera.actions)
- Character Home (mtw.ephemera.actions)
- Character Moved (mtw.ephemera.positions; `froms[]` + `to` graph-diff fact; consumed by mtw.ephemera.perception fan-in F2-2)
- Play membership storage: `Meta::Room.positionGraph` + adjacency index (S2-5); transitional dual-write to `activeCharacters` / `RoomId` (S2-2)
