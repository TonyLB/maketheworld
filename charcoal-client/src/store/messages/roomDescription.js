import baseMessage from './base.js'

export class roomDescription extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { description = 'This is a place.', name='A place' } = props
        this.description = description
        this.name = name
    }
}

export default roomDescription
