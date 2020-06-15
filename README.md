Make The World
==============

Make The World is a multi-user text game, in the style of Multi-User-Dungeon (MUD) games that have populated the internet since the 80s.  Unlike some
other systems, Make The World is cloud-native, residing in AWS and accessible through any web-browser (okay, *most* web-browsers, I'm sure you can
find compatibility complaints with something).

Make The World is very much a work in progress:  Version 1 provides the minimal features that make a viable game, and we hope people will enjoy
it, but there is much much more coming in version 2:  Objects, for a start.  What's an epic fantasy world without the ability to type "get magic sword",
after all?

### What Make The World includes

- Globally available web-based chat client
- Industry-grade (AWS Cognito) login security to keep your access safe and private
- Characters you can create and customize as you desire
- Rooms you invent, to set the scene and group which characters are chatting with which
- Exits between Rooms to create the imaginary geography
- Direct messaging to reach characters wherever they are
- Neighborhoods that encompass multiple Rooms (and other Neighborhoods)
- Neighborhood-granularity permissioning, to let people invite their friends to edit their creations
- Neighborhood-granularity publishing settings, so that new players can create immediately but impressionable innocents don't see their material until
someone with a public neighborhood agrees to host it in the "main world"
- Button-click backup procedures to save your world
- Backup JSON downloads to pull your content out of the cloud and onto your device (for whatever purpose)
- Backup JSON import, to add content from another Make The World instance, a library, or wherever

### What Make The World doesn't include (yet)

- More robust moderation tools, to deal with potential bad actors (spammers, trolls, etc.)
- In-game Objects
- Asynchronous messaging, to leave folks in-game notes
- Scene requests, to tell people what you'd like to play and what kind of people would help you do it
- World-state and a set of tools to automate changes (day/night cycle, sudden descent into apocalypse, etc.)
- Story authoring tools to create automated quests, riddles and events that people can opt into

How does Make The World work (tech stack)
=========================================

Okay, technical talk here, feel free to glaze over and move to the next section ... or perk your ears up, if this is your jam.

Make The World is a serverless build on the Amazon Web Services platform.  When someone creates an instance, the CodeBuild process in AWS Amplify does
the following things:
- Provisions a temporary virtual computer as a marshalling ground from which to deploy system resources
- Pulls a clone of this repository into that marshalling ground
- Uses CloudFormation to instantiate a whole lot of resources.
- Populates the databases it just instantiated with basic information to create the starting skeleton of a world
- Builds a version of the front-end client that knows where to find those resources
- Places the files for that client in a storage-cache managed by Amplify
- Serves those files at a web-address it gives you (so people can find the system and use it)
- ... and then decommissions the marshalling ground, so you aren't paying for a computer that no longer has a job to do

### CloudFormation resources

CloudFormation is the AWS solution for *Infrastructure as Code*, which means basically "I write some code *describing* what a set of cloud
resources to look like, then CloudFormation *creates* those resources when I ask it to."  Make The World uses two distinct templates, to
create two *Stacks* (CloudFormation's way of grouping a set of resources created together).

#### permanentsTemplate.yaml

This describes the infrastructure requirements of the pieces of Make The World that should stick around forever (even if you're doing updates
or tinkering with the code) and never be disturbed:
- The Cognito pool of user names and login credentials
- The *permanents* DynamoDB table, which stores anything that should still be around in your system even if everyone goes on vacation for a
few months, then comes back ... so rooms, characters, permissions, all that jazz
- An S3 object-storage bucket for files (like backup files) managed by the system.

If you remove the Permanents stack, it will decommission the resources that are storing your game ... and that game will be *gone*.  Now maybe
you've got a backup file saved to your desktop, and you can bring back the contents of the permanents table, in order to recreate the structure
of the world you created.  But there is (by design) just nothing that can be done to bring back the security setup of the Cognito file.
That's run by Cognito, which doesn't let anyone get at it (so as not to have everyone and their sister stealing passwords), so if you remove it
and recreate it then *at best* your players will need to recreate their accounts, and it's just a lot of chaos.

Unless you are absolutely positively sure you know what you are doing, do *not* delete the Permanents Stack.

#### template.yaml

This describes the much, much more extensive infrastructure requirements of the pieces of Make The World that actually make it run.  They rely
upon the *data* in the Permanents stack, but then use it to actually do things.  This file creates the main stack, which has just a *ton* of stuff.
A small sampling:
- DynamoDB tables for *ephemera* and *messages*
- A data schema in AppSync (the AWS mobile-data service) that handles every interaction between the client and the data (permanent and ephemeral)
of your world
- Several Lambda function (the AWS solution for running code in the cloud) that act as glue to make sure that data is consistent
- A file proxy API to let the client push and pull backups
- A real-time API for connection to the client, so that the system can know quickly when somebody closes their tab (no more of that tedious
problem of people losing their connection but not formally logging out)

Now Make The World cannot run *without* these resources.  They are, in a very real way, what Make The World **is**.  But the system has been designed
so that this main stack has only the resources that you could easily recover from losing.  Lose a Lambda function and replace it with an identical
one?  The system won't even know.  Lose the *ephemera* table?  Oh no, the system will forget where off-line players are located, and they will be
in their homes when they next log in.  Lose the *messages* table and you'll lose the room recaps from the last five minutes.

Which is to say:  If you have the technical know-how and a reason to delete the main stack and recreate it, *feel free*.  That's what it's there for.
But don't touch the permanents stack if you can possibly avoid it, I'm not kidding.

### The system in operation

So, suppose you've run the install, and it worked out fine (fingers crossed!)  You noticed that the only server (even virtual) that gets instantiated
by the system also gets *decommissioned* at the end of the install process.  If you (like me) came up in the programming era of the 90s and 00s, you
can knock around the AWS system all you want (I'd recommend starting in the EC2 area) trying to answer the immediate question "Where is my server?  Where
is Make The World *running*?"

It's not there.  Don't panic.  That's not how serverless systems work.  Make The World creates computing resources in response to events.  If nobody is
on your system, then the system is nothing but inert storage and a web-site.  When someone logs in to the web-site ... well then, things get going:  Each
time a user does something that requires changes to the system, AWS apportions a tiny fraction of a virtual server's time, loads the needed code from
a high-speed cache in a miniscule fraction of a second, does what needs to be done and then takes the resources back.

At its best (which we aspire to), serverless architecture means that the compute resources just *work*, the way you can plug a television into the wall
and just get electricity: CPU cycles, hot and cold, on tap from AWS's incalculably robust supply.  Likewise, all of the data resources are stored
in AWS serverless solutions ... they respond to requests, but you don't have to think of them as actually *residing* anywhere.  There is no server
that can get struck by lightning, or upgraded wrong by your service company.  What there is instead is a world-spanning *network* of servers, supporting
a pretty hefty chunk of our information economy ... and we get to peel off penny-sized increments of that power for our own purposes.

Some days I really enjoy living in the future.

How to deploy my own Make The World
===================================

Ready to take the plunge?  Okay, we'll make this as easy for you as possible.  Be ready to spend a few hours on this process.

#### Setting up an AWS account

Make The World operates within AWS, so to install it you're going to need *access* to AWS.  Now AWS is intimidating as *heck* ... it has well over a hundred
menu options.  You only have to deal with a few of them though, and everyone before you has had to do the same thing so it's pretty well documented.
You will need: an email account and a credit card, and the steps below will walk you through making an AWS account and a Github account. If you have those
already, great, use them.

As you go through these steps, you may end up somewhere in the AWS console that you didn't expect.  Here is a set of short-cuts back to the top level of the
places you'll need to be.  If you get lost, you can probably come back here and click to just the area you want to pay attention to.  NOTE:  Do not start clicking here!
This is a resource to *come back to* if you need to ... skip forward to "Create an Account" if you haven't already:

[Billing](https://console.aws.amazon.com/billing/)

[Identity and Access Management](https://console.aws.amazon.com/iam/)

[AWS Amplify](https://console.aws.amazon.com/amplify/)

[Cloudformation Resource Management](https://console.aws.amazon.com/cloudformation/)

[DynamoDB Data Storage](https://console.aws.amazon.com/dynamodb/)

AWS is a system with a *very large number* of different panels and console, most which you will never, never need to get access to.  But clicking on
a link that looks promising can sometimes get you somewhere you didn't expect to be.  So if you get lost, the links above are your chance to reorient:
Find the section you need to be working on, click its link above, and back up in the instructions to figure out how to get from the landing area of that
console to the place you need to be at your given step.

Ready?  Cool, head over to AWS (first) and work through these steps

##### 1/8: Create an account

First, [create an account](documentation/createAccount.md).  This will require an email account and a credit card. AWS is pay-as-you-go, and a MTW installation
will generally cost a few dollars a month to run, if that. Like, under $5 USD/month unless you have many, many people.  Make sure you are selecting "Free Tier"
wherever possible, and avoid any choices (particularly Support Plan) that would add costs.  You just want to pay for some computer power, not buy all their
digital bric-a-brac.

It can look like you’re all set when you still have two steps left: when you have the choice between Root and IAM (Identity and Access Management}, choose Root,
and click the big orange button at the top right that says “Sign in to the Console”

##### 2/8: Create a Budget

Next thing:  You just gave your credit card information to a system that bills you as you go, and creates resources to bill you for in ways that can be
opaque.  It's very important that you put some common-sense limits on that, first thing, so let's assign a budget to set the maximum that AWS will bill
you in a month ... after which it will just cut you off.  It's unlikely you'll ever get there, but safety first:

[Make an AWS Budget](documentation/budget/budget.md)

At the end of those two steps, you should have one account that you still log in to with its root credentials.  You'll need that, long-term, in order to check
out the Budget, but those credentials can do *anything*.  Using it is like walking around with in an ADMIN account in a MUSH; avoid it unless you need those
powers specifially. You want to log in that way very, very seldom.

##### 3/8: Create an IAM Role

AWS provides a tool called *IAM* (Identity and Access Management) that lets you create a user that is still provisioned to do *almost* anything but is importantly
firewalled away from billing matters.  It's best not to login with higher-level authorization than you need, to avoid problems. Especially money problems.  Do that
next (the top part ... you don't need the second bit where they show you an alternate path to do the same thing):

[Make your first IAM user and Administrator Group](documentation/iamRole.md)

You have an AWS account now, so you can start the install process in earnest.  

##### 4/8: Create a Service Role for Amplify

You've been needing to do all this configuration manually in order to get a mostly-empty AWS account, but it would be *appalling* to need to do the entire configuration
of the MTW system.  Fortunately, AWS provides a service (Amplify) which deploys and configures applications just like MTW.  We're going to use that to do most of the
rest of the heavy lifting, by pulling code from this GitHub repository, and using it to create the system in your account.  Before you deploy, you will need to give
Amplify permissions to set up infrastructure.  That means creating another IAM *role* (though **not** another *user* ... this role will give permissions to a system
rather than a person) that holds the permissions you want to grant to Amplify (broadly "almost everything"):

[Add a service role](documentation/serviceRole.md)

##### 5/8: Configure a GitHub account

When AWS deploys, it will want to do so from *your* GitHub account ... it will read code from your space, so that you control precisely what it is running off of.
So the next step is to configure a GitHub account with the code you will need:

[Configure GitHub](documentation/github.md)

##### 6/8: Deploy the system

Now that you have both an AWS account and a GitHub account with the correct code, you can ask the AWS Amplify service to use that code in order to instantiate
a Make The World instance:

[Deploy Make The World](documentation/deploy/deploy.md)

##### 7/8: Protect your cloud resources

If you've gotten this far, you have an (empty) Make The World instance running under your own resources.  Congratulations!  Let's make it a bit safer from
accidental damage:

1. Go to the [Cloudformation Console](https://console.aws.amazon.com/cloudformation/).

2. You should see two stacks staring with the prefix "mtw" (one for Permanents and one for everything else).  These groupings hold the AWS resources
that are keeping the system running.

3. Select the Permanents stack.

4. In the upper right there is a button for Stack Actions.  Select that, and click "Edit Termination Protection".

5. Select 'Enabled' and save.

Now you won't accidentally purge all your irrecoverable data.  If you ever *want* to purge
that data (as, for instance, in removing MTW from your account), you'll have to manually set it to be possible.

##### 8/8: Create your MTW administrator account

Now it's time to get into the actual content of your system.  In the "Deploy Make The World" step you got a link to the web-site that Amplify created.  Head there and
register with the system.  Once you have a username and password you can log in with, consent to the code of conduct and make a new character to act as your
administrator identity.  You will be in the Vortex ... currently the only room that exists in your world.  The problem is, you're there as a *character*, and 
what you wanted was an administrator.

One last AWS task:  You need to assign an admin, which (for obvious reasons) you can't do just by logging in anonymously to the MTW system.

1. Go to [DynamoDB Data Storage](https://console.aws.amazon.com/dynamodb/)

2. Click the "Tables" tab, and you will see the three Make The World tables (ephemera, messages and permanents).

3. Click the permanents table and select the "Items" tab in order to see the contents of your database.  There probably won't be much there yet... you can just
scroll through directly.

4. Find a record with a PermanentId of 'CHARACTER#blah-blah-blah-unique-id', and a DataCategory of "GRANT#MINIMUM".  This represents your character's basic permissions,
what they are allowed to do everywhere, at all times.

5. The data in the PermanentId column doubles as a link.  Click that link, in the row you've found, to open up an edit screen.

6. You'll see that it has a data element "Roles" that is currently set to "PLAYER".  Edit that and set it to "ADMIN".  Spell it correctly ... it's a computer-read
term, so capitalization counts.

7. Go back to your window on the game itself, and refresh to log in again (to pick up that database change).

8. Your character is now an administrator!  That gives you access to the Administration panel in the upper left menu of the game, which lets you make backups,
import content, all that.  You should also now have the ability to make not just private dead-end neighborhoods, but big, connected, public neighborhoods.

9. Make some neighborhoods, and populate them with connected rooms, and you're on your way to having your own fictional world!

Good luck!

##### 9/8: (Optional) Make your environment more robust

Make The World uses AWS Cognito to handle its sign-up and sign-in functionality.  And AWS Cognito (by default) uses a test email address to send out validation
emails giving people the code they'll need to sign up.  Amazon limits the number of emails it is willing to send from such test email addresses, to no more than 50 per
day.  If you expect to have people signing up at a faster pace than that, you will want to register an email you *already control* with AWS, telling AWS that it
can send emails on your behalf from that address.  Once you do that, Amazon will happily send many hundreds of emails per day.

1. Go to AWS's [Simple Email Service](https://console.aws.amazon.com/ses)

2. Select "Email Addresses" (under "Identity Management") in the side bar at left.

3. Select "Verify a New Email Address"

4. Enter the address you want to verify.

5. Check that address for a verification email.

6. Respond to the verification email.

7. Once the AWS console agrees that the address has been verified as one you control, navigate to [Cognito User Pools](https://console.aws.amazon.com/cognito/users/)

8. Select the User Pool that corresponds to the application you wish to raise limits on

9. In the menu on the left side, select "Message customizations" under "General Settings".

10. Where it says "Do you want to send emails through your Amazon SES Configuration?" select "Yes".

11. Fill in your email address on *both* the "From email address ARN" and "From email address" fields.

##### 10/8: (Optional) Mount a second (or third) MTW instance in the same account

After you've mounted one MTW instance, it is much simpler to mount more:

[Mount a second instance](/documentation/secondBranch/secondBranch.md)

### Manual deployment for development

If you want to tweak the software behind Make The World, make it your own, maybe do better than us ... have at!  Sounds great.  You'll want to clone this
respository locally (whatever that looks like in your development environment), and then get a development instance up and running to play around with.

Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and use it to package,
deploy, and describe your application.  These are the commands you'll need to use:

First, deploy the permanent storage stack for the world (with fictitious parameters for AppID, since you don't actually have one of those):
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name (your chosen prefix)PermanentsStack \
    --parameter-overrides TablePrefix=(your chosen prefix) AppID=(some fiction like '1234', but more random ... it cannot conflict with anyone else in the world)
    --capabilities CAPABILITY_IAM
```

Next deploy the running application stack.  Because of the nature of SAM, that's going to involve making yourself an S3 bucket to store code and
templates (so CloudFormation can get to them easily).  Make it in the console, then:

```
sam package \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket REPLACE_THIS_WITH_YOUR_S3_BUCKET_NAME

sam deploy \
    --template-file packaged.yaml \
    --stack-name (your desired stack name) \
    --capabilities CAPABILITY_IAM

aws cloudformation describe-stacks \
    --stack-name (your stack name) --query 'Stacks[].Outputs'
```

If you have changed the GraphQL schema that runs the data back-end, you will need to update the generated graphQL libraries in the charcoal client
(NOTE:  The first time, you will also need to run "amplify codegen add", to tell your local development stack that you're using amplify codegen
to keep your graphQL libraries up to date with changes)

```
cd charcoal-client

aws appsync get-introspection-schema --api-id (your appsync API ID) --format JSON schema.json
amplify codegen
```

#### Deploying separate development stacks

If you want to have multiple stacks running simultaneously (for dev and staging, for instance), you can do that too.  Create a separate stack by running
the deploy commands again, with some changes and overrides.

First, deploy a new permanent storage stack for the world (with fictitious but different parameters passed for AppID):
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name (new prefix)PermanentsStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides TablePrefix=(new prefix) AppID=(some new fiction)
```

Next deploy the running application stack:

```
sam package \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket REPLACE_THIS_WITH_YOUR_DEV_S3_BUCKET_NAME

sam deploy \
    --template-file packaged.yaml \
    --stack-name (new prefix)Stack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides TablePrefix=(your previous table prefix) PermanentsStack=(your PermanentsStack name)

aws cloudformation describe-stacks \
    --stack-name (your main stack name) --query 'Stacks[].Outputs'
```

#### Deploying the front end

Finally, you'll have to dig down into the *charcoal-client* directory, and read its README.md as well.  There are some
steps that need to be taken there, in order to inform the client about the cloudformation resources you have created, before
it can be started against the back-end.

### Removing all MakeTheWorld resources

You've tinkered around, and decided this isn't something you want to keep maintaining long-term?  No problem.  It's pretty easy to remove from
the AWS console.

IMPORTANT NOTE:  This process will delete all of your cloud resources.  By default, **backups** are stored in the Make The World cloud resources,
and will be deleted when you do this.  If you intend to keep the content of your instance, you need to have created a backup and *downloaded it*
to a local machine, before you do this.

1. Go to Amplify:  Select your app, and delete it.

2. Go to S3:  There is a permanentstack storage bucket there.  It has all your backups, so maybe copy those down if you want to keep them for sentimental
(or other) reasons.  When you're sure you don't need the data any more, select the bucket and click the 'Empty' button.

3. Go to CloudFormaton:  There are two stacks there (one for permanents and one for everything else).  Click the 'everything else' stack and delete it.
Once that is complete, click the permanents stack and delete it.

That's it:  Make The World should be removed completely from your AWS account.


## License Summary

This code is made available under a modified MIT license. See the LICENSE file.
