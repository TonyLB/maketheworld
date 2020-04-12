import baseMessage from './base.js'

export class playerMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { CharacterId = '', Message = '' } = props
        this.CharacterId = CharacterId
        this.Message = Message
    }
}

export default playerMessage