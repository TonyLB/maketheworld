You have both an AWS account and a GitHub account.  What we are going to do in this section is to ask the AWS Amplify service to clone the MTW repository
into your GitHub account (so you have your own copy) and then to instantiate Make The World from the code you copied.

The thing is ... sorry ... it's going to *fail* the first time.  Remember the service role you created to let Amplify do its job?  Amplify doesn't know
about that Service Role setting until after you've set it *on a particular project*, and you don't have a project to set it on until after the first time
you've tried to deploy (and failed).  We're consulting with AWS support to find a way around that for version 1.1, but for 1.0 you're going to make a
first attempt at a deploy, have it fail, set the service role, then redeploy.

1. To get started, click this button **once** (and once only, please):

[![amplifybutton](https://oneclick.amplifyapp.com/button.svg)](https://console.aws.amazon.com/amplify/home#/deploy?repo=https://github.com/TonyLB/maketheworld)

2. Amplify will guide you through getting connected to GitHub.  Once you've started the deploy, maybe go get a snack. It can take five minutes easy to
provision all the bits that happen before the failure.

3. Once the deploy has failed in the Build stage, you've made progress.  You now have the *data* for an application in Amplify (basically, the outer wrapper of
an application, without the inside guts that actually make it work).  Amplify is a tool that lets you tweak that data and make more attempts to get to the
point where it can deploy what you need in order to run.

4. Unfortunately, it is possible that the initial (failed) build has left behind an artifact that could block the next build.  The resources that Amplify
sets up are stored in a different part of AWS, called *CloudFormation*, in groups that it calls "stacks".
Go to [Cloudformation](https://console.aws.amazon.com/cloudformation/) now and check whether Amplify created any stacks (possible "mtwPermanentStack").
If it has, they will likely be in a state called "ROLLBACK_COMPLETE", which is challenging for the system to get around.  They aren't useful to you (yet...
later stacks in this same place will be very important indeed), so if there are any MTW stacks then you will need to delete them.  Click the little circle on the left
in order to select one, then click the "Delete" button at upper right to remove it.  This will take some time.

(NOTE:  If you have any stacks in Green states like "Create Complete" or "Update Complete" then they *have not failed*, so be very hesitatant about deleting them.
Also (though this might be obvious) if you are using a pre-existing account and there are non-MTW stacks, don't delete them, they're probably doing something
important)

5. We're going to modify that data to give Amplify the permissions to do what it needs to do.  If you
aren't already there, go to [Amplify](https://console.aws.amazon.com/amplify/) and select the application you have created.  Find the "General" tab on the left,
and click it.

6. You'll see two sections:  One "settings" section at top has a listing of links to various repositories (none of which you will ever need to follow), as well
as some other settings.  Below that is a section of "Branches".  A GitHub repository has different sets of code that it refers to as branches, and Amplify links
to one of those branches in order to know where to get code.  The automated deploy has already connected to the "Version-One-Zero" branch in your copied
repository, so you don't need to change anything on that bottom section.  What you want is to change the Service Role item in the upper (settings) section.

7. There will be an "Edit" button in the upper right of this page, just under the "Action" button.  Select that to allow you to edit the app settings.  Down at
the bottom of that page there is a setting for "Service Role".  Select the one you created in the "Create a Service Role for Amplify" step, and save.

8. You're now ready for your second (hopefully successful) deploy:  Make sure you are in [Amplify](https://console.aws.amazon.com/amplify/).  Select your
Make The World application and you will see an overview that includes a list of front-ends you have deployed (as well as their status).  You should see one
deployment.

9. Context:  Each deployment (one, in this case) has a link at the top for working with Amplify's control of the app (in your case this link will say "Version-One-Zero").
The deployments also have a link at the bottom (which will say "https://version-one-zero.somethingsomething.amplifyapp.com") ... and also a link down at the middle
right to the GitHub repository, which you can ignore.  The <strong>top</strong> link will navigate to a part of the Amplify console that lets
you work with the deployment (currently interrupted).  The <strong>bottom</strong> link will take you to the web-site once it is deployed (not yet).

10. For now, click that top link to get to the page that lets Amplify adjust that deployment.  At the upper right of that screen will be a button saying
"Redeploy this version".  Click that button.

11. In order to watch progress, go back to the [Amplify Console](https://console.aws.amazon.com/amplify/) and select the application you have created.
It should, once again, show you a list of your one deployment.  That list will show you the progress of Provisioning, Build, Deploy and Verify.
This time it should succeed!  Be warned:  Succeeding takes *even longer* than failing, since the system has a create a bunch of resources that will
sustain your instance.  Be patient.

12. Sometimes something does go wrong, usually in the Build stage.  If the process ends with a red X in some circle, you can click on that to open
a log of everything that has happened.  Some subsection will also have a red X:  Click to open that section, and it will give you a gigantic list of the
command-line outputs of the process.  Near the bottom of that list will be the last few commands that caused the error, and they may give you a good idea of
what happened and how to fix it.  For instance, if they read *"...1abab539 is in ROLLBACK_COMPLETE state and can not be updated"* then you've got a CloudFormation
stack that is blocking your deployment, and returning to step 4 can get you back on track.

13. When all four circles fill green, you *have a working MTW instance installed*.  As mentioned in step 9, there is a link at the bottom left of the "Version-One-Zero"
section.  It looks like a web address.  It is the web address of your MTW world.  If you click on that, you should end up at a screen asking you to log in to the
system.  That's probably a good web address to bookmark.
