import baseMessage from './base.js'

export class playerMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, CharacterId = '', Message = '' } = props
        this.MessageId = MessageId
        this.CharacterId = CharacterId
        this.Message = Message
    }
}

export default playerMessage