import baseMessage from './base.js'

export class directMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Message = '', CharacterId, Recipients } = props
        this.MessageId = MessageId
        this.Message = Message
        this.CharacterId = CharacterId
        this.Recipients = Recipients
    }
}

export default directMessage