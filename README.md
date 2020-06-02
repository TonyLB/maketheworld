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

Ready to take the plunge?  Okay, we'll make this as easy for you as possible.

#### Setting up an AWS account

Make The World operates within AWS, so to install it you're going to need *access* to AWS.  Now AWS is intimidating as *heck* ... it has well over a hundred
menu options.  You only have to deal with a few of them though, and everyone before you has had to do the same thing so it's pretty well documented.
Head over to AWS and work through these tutorials:

First, create an account.  Make sure you are selecting "Free Tier" wherever possible, and avoid any choices (particularly Support Plan) that would add costs:

[Make an AWS Account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)

Next thing:  You just gave your credit card information to a system that bills you as you go, and creates resources to bill you for in ways that can be
opaque.  It's very important that you put some common-sense limits on that, first thing, so let's assign a budget to set the maximum that AWS will bill
you in a month ... after which it will just cut you off.  It's unlikely you'll ever get there, but safety first:

[Make an AWS Budget](https://aws.amazon.com/blogs/aws-cost-management/getting-started-with-aws-budgets/)

At the end of those tutorials, you will have one account that you still log in to with its root credentials.  You'll need that, long-term, in order to check
out the Budget, but those credentials can do *anything*.  You want to log in with those very, very seldom.  AWS provides a tool called *IAM* (Identity and
Access Management) that lets you create a user that is still provisioned to do *almost* anything but is importantly firewalled away from billing matters.
Do that next (the top part ... you don't need the second bit where they show you an alternate path to do the same thing):

[Make your first IAM user and Administrator Group](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html)

Now set things up so that you can log in to the AWS web Console using this new, slightly safer, user ... and probably bookmark the login-site:

[Create a sign-in portal](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_how-users-sign-in.html)

You have an AWS account now, so you can start the install process in earnest.  

Before you deploy, you will need to give Amplify permissions to set up infrastructure.  That means creating another IAM *role* (though not another
user) that holds the permissions you want to grant to Amplify (broadly "almost everything").  Note that you have an existing app, so you will be using
the instructions at top, then skipping one step that doesn't apply because you have no Amplify-generated back-end, then the instructions at bottom 
(where it says "If you already have an existing app"):

[Add a service role](https://docs.aws.amazon.com/amplify/latest/userguide/how-to-service-role-amplify-console.html)

Now that you have an AWS account and proper permissions, you can ask the AWS Amplify to read this repository and instantiate Make The World:

[![amplifybutton](https://oneclick.amplifyapp.com/button.svg)](https://console.aws.amazon.com/amplify/home#/deploy?repo=https://github.com/TonyLB/maketheworld)

Maybe go get a snack once that has started.  It can take ten minutes or so easily, and sometimes takes longer.


### Manual deployment for development

If you want to tweak the software behind Make The World, make it your own, maybe do better than us ... have at!  Sounds great.  You'll want to clone this
respository locally (whatever that looks like in your development environment), and then get a development instance up and running to play around with.

Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and use it to package,
deploy, and describe your application.  These are the commands you'll need to use:

First, deploy the permanent storage stack for the world:
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name (your chosen prefix)PermanentsStack \
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

#### Deploying separate development stacks

If you want to have multiple stacks running simultaneously (for dev and staging, for instance), you can do that too.  Create a separate stack by running
the deploy commands again, with some changes and overrides.

First, deploy a new permanent storage stack for the world:
```
aws cloudformation deploy \
    --template-file .\permanentsTemplate.yaml \
    --stack-name (new prefix)PermanentsStack \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides TablePrefix=(something other than mtw)
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

## License Summary

This code is made available under a modified MIT license. See the LICENSE file.
