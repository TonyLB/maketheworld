import { isStandardNDJSONLine } from './baseClasses'
import { isStandardComponentData } from './components/dataTypes'

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
            examples: [{ key: "base", tag: "Example" }],
            from: "ASSET#primitives"
        }
        expect(isStandardNDJSONLine(line)).toBe(true)        
    })

    it('should correctly identify component data', () => {
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
            examples: [{ key: "base", tag: "Example" }],
            from: "ASSET#primitives"
        }
        expect(isStandardComponentData(line)).toBe(true)
    })

})