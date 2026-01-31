import { Schema } from '..'
import { selectKeysByTag } from './keysByTag'

describe('keysByTag selector', () => {
    it('should select keys by tag even nested deeply', () => {
        const testOne = new Schema()
        testOne.loadWML(`
            <Asset uuid=(testOne)>
                <Room key=(room1)>
                    <ShortName>Test room</ShortName>
                    <Description>
                        TestZero
                        <Link to=(feature1)>Link</Link>
                    </Description>
                    <Exit to=(room2)>Exit</Exit>
                </Room>
                <Room key=(room2) />
                <Feature key=(feature1) />
                <Feature key=(feature2) />
            </Asset>
        `)
        expect(selectKeysByTag('Room')(testOne.schema)).toEqual(['room1', 'room2'])
        expect(selectKeysByTag('Feature')(testOne.schema)).toEqual(['feature1', 'feature2'])
    })

})
