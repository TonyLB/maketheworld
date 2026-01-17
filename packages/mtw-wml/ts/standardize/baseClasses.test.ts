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
                reference: { tag: "Room", key: "marketSquare" },
                payload: "market square"
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
                reference: { tag: "Room", key: "marketSquare" },
                payload: "market square"
            }],
            examples: [{ key: "base", tag: "Example" }],
            from: "ASSET#primitives"
        }
        expect(isStandardComponentData(line)).toBe(true)
    })

})