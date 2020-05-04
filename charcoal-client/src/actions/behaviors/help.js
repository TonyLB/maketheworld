import { activateHelpDialog } from '../UI/helpDialog'

export const help = () => (dispatch) => {
    dispatch(activateHelpDialog())
}

export default help