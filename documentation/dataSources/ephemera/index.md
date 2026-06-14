# Ephemera Data Source

## Stream

**Source**: mtw.ephemera

Events:

- Asset Cached
- Asset Decached
- Component State Update [To Be Implemented]
- Character Navigate (mtw.ephemera.actions)
- Character Home (mtw.ephemera.actions)
- Character Moved (mtw.ephemera.positions; `froms[]` + `to` fact shape shipped; consumed by mtw.ephemera.perception fan-in F2-2)
