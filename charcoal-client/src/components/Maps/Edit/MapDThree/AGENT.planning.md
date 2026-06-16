# MapDThree Refactoring Planning

## TEMPORARY KNOWLEDGE - REMOVE WHEN REFACTORING COMPLETE

### Key Findings for MapDThree Simplification

#### What Can Be Simplified
- **Remove conditional functionality**: No more DFS traversal for conditional visibility
- **Remove visibility toggles**: Eliminate complex layer management for conditional rendering
- **Focus on core data**: Only need `StandardPosition` entries and `StandardExit` network from rooms
- **Flat tree structure**: Target state will be simple two-level structure (Asset → Map → Rooms with Exits)

#### What Must Be Preserved
- **Two-layer inheritance system**: Inherited (from `fetchImportsByDefault`) vs. edited (local changes)
- **Asset context tracking**: Distinguish rooms from different inherited assets
- **Basic layering**: Handle merge between inherited and local data

#### Data Flow
- **Backend (runtime):** server map delivery retired; subscribe returns empty snapshots ([`lambda/ephemera/dataSource/maps/AGENT.md`](../../../../../../lambda/ephemera/dataSource/maps/AGENT.md))
- **Frontend (authoring):** `cacheToTree()` transforms to simple tree, `extractRoomsHelper` handles inheritance
- **Redux**: `personalAssets` maintains `inherited`, `base`, and `edit` layers

#### Target Architecture
```
Asset (render)
└── Map
    ├── Room (room1) [x, y] - from inherited asset
    ├── Room (room2) [x, y] - edited locally
    └── Room (room3) [x, y] - new addition
```

**Note**: This document contains temporary knowledge of systems that need to be refined. Remove when refactoring is complete.
