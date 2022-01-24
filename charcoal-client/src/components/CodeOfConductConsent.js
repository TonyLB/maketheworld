import React from 'react'

import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Button
} from '@mui/material'

export const CodeOfConductConsentDialog = ({ onConsent = () => {}, open=false }) => {
    return <Dialog
            maxWidth="lg"
            open={open}
        >
            <DialogTitle sx={{ bgcolor: 'lightblue'}} >
                <Typography align="center">Welcome to Make The World</Typography>
            </DialogTitle>
            <DialogContent>

                Make The World is based on core concepts of consent, player agency, and communication.
                In order for everyone to play together, there are some ground rules:

                <ul>
                    <li>
                        <b>Be compassionate.</b> There are real people on the other side of the screen, with real emotions, real challenges, and their real share of the world’s
                        pain and suffering.            
                    </li>
                    <li>
                        The clauses against <strong>hate speech</strong> from the codes of conduct at your local middle school / high school / college / workplace / convention are in effect
                        here as well. Just like in those places, there are consequences here.
                    </li>
                    <li>
                        <b>Share the work, share the fun.</b> While there are moderators here, there are not over-arcing GMs or plots, and you will be more responsible to find or
                        bring or make your own fun and plot. 
                    </li>
                    <li>
                        <b>Color in the world, but color on your own page.</b> Feel free to add environmental details about pretty much anything pretty much always, but only describe
                        your own character's actions and emotions.
                    </li>
                    <li>
                        <b>When in doubt, ask.</b> Ask yourself, ask other players, ask moderators, ask friends IRL. 
                    </li>
                </ul>

                Ready to make a character? By clicking I CONSENT, you are acknowledging you have read and agree to the ground rules above. 

            </DialogContent>

            <Button onClick={onConsent}>I CONSENT</Button>

        </Dialog>
}

export default CodeOfConductConsentDialog
