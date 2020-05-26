import baseMessage from './base.js'

export class directMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { MessageId, Message = '', FromCharacterId, ToCharacterId } = props
        this.MessageId = MessageId
        this.Message = Message
        this.FromCharacterId = FromCharacterId
        this.ToCharacterId = ToCharacterId
    }
}

export default directMessage