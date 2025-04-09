import { isStandardNDJSONLine } from './baseClasses'

describe('StandardForm baseClasses', () => {
    it('should correctly identify an NDJSON line with additional fields', () => {
        const line = {
            key: "VORTEX",
            universalKey: "ROOM#VORTEX",
            tag: "Room",
            shortName: "Sturdy Mug",
            exits: [{
                data: {
                    tag: "Exit",
                    key: "VORTEX#marketSquare",
                    from: "VORTEX",
                    to: "marketSquare"
                },
                children: [{ data: { tag: "String", value: "market square" }, children: [] }]
            }],
            themes: [],
            examples: [{ key: "base", tag: "Example" }],
            from: { action: "Content", payload: { assetId: "primitives", fromKey: "VORTEX" } }
        }
        expect(isStandardNDJSONLine(line)).toBe(true)        
    })
})