import { deIndentWML } from '.'

describe('deIndentWML', () => {
    it('should leave unindented WML unchanged', () => {
        const testWML = '<Asset uuid=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>'
        expect(deIndentWML(testWML)).toEqual(testWML)
    })

    it('should unindent', () => {
        expect(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ABC)>
                    <Exit to=(DEF)>Test Exit</Exit>
                </Room>
            </Asset>
        `)).toEqual('<Asset uuid=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>')
    })
})
