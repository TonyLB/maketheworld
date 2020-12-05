import React, { useState } from 'react'

// MaterialUI imports
import {
    Stepper,
    Step,
    StepContent,
    StepButton,
    Button
} from '@material-ui/core'

// Local code imports
import useStyles from '../styles'

export const NonLinearStepper = ({ steps = [], completed = {} }) => {

    const classes = useStyles()
    const [activeStep, setActiveStep] = useState(0);
  
    const totalSteps = () => {
      return steps.length;
    };
  
    const completedSteps = () => {
      return Object.values(completed).filter((value) => value).length;
    };
  
    const isLastStep = () => {
      return activeStep === totalSteps() - 1;
    };
  
    const allStepsCompleted = () => {
      return completedSteps() === totalSteps();
    };
  
    const handleNext = () => {
      console.log(completed)
      const newActiveStep =
        isLastStep() && !allStepsCompleted()
          ? // It's the last step, but not all steps have been completed,
            // find the first step that has not been completed
            steps.findIndex((step, i) => !((i in completed) && completed[i]))
          : activeStep + 1;
      setActiveStep(newActiveStep);
    };
  
    const handleBack = () => {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };
  
    const handleStep = (step) => () => {
      setActiveStep(step);
    };
      
    return (
        <React.Fragment>
            <Stepper nonLinear activeStep={activeStep} orientation="vertical" >
                {steps.map(({ label, content, optional = false }, index) => (
                    <Step
                        key={label}
                    >
                        <StepButton onClick={handleStep(index)} completed={completed[index]} >{label}</StepButton>
                        <StepContent>
                            {content}
                            <div className={classes.actionsContainer}>
                               <div>
                                    <Button
                                        disabled={activeStep === 0}
                                        onClick={handleBack}
                                        className={classes.button}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        disabled={activeStep === steps.length -1}
                                        variant="contained"
                                        color="primary"
                                        onClick={handleNext}
                                        className={classes.button}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </StepContent>
                    </Step>
                ))}
            </Stepper>
        </React.Fragment>
    );
}

export default NonLinearStepper