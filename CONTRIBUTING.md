#ContributingtoUDB

ThankyouforyourinterestincontributingtoUDB!Thisdocumentprovidesguidelinesandinformationforcontributors.

##TableofContents

-[CodeofConduct](#code-of-conduct)
-[GettingStarted](#getting-started)
-[DevelopmentSetup](#development-setup)
-[HowtoContribute](#how-to-contribute)
-[PullRequestProcess](#pull-request-process)
-[CodingStandards](#coding-standards)
-[Testing](#testing)
-[Documentation](#documentation)
-[ReleaseProcess](#release-process)
-[Governance](#governance)

---

##CodeofConduct

Thisprojectfollowsasimplecodeofconduct:

1.**Berespectful**-Treateveryonewithrespectandprofessionalism
2.**Beconstructive**-Providehelpfulfeedback,notcriticism
3.**Bepatient**-Maintainersareoftenvolunteerswithlimitedtime
4.**Beinclusive**-Welcomenewcomersandhelpthemcontribute

Violationsshouldbereportedtothemaintainers.

---

##GettingStarted

###WhatCanIContribute?

|Type|Examples|Process|
|------|----------|---------|
|**BugFixes**|Fixcrashes,incorrectbehavior|OpenPRdirectly|
|**Documentation**|Fixtypos,clarifyexplanations|OpenPRdirectly|
|**Tests**|Addmissingtests,improvecoverage|OpenPRdirectly|
|**SmallFeatures**|Minorenhancements,CLIflags|Openissuefirst|
|**LargeFeatures**|Newcommands,protocolchanges|RFCrequired|

###BeforeYouStart

1.**Checkexistingissues**-Someonemayalreadybeworkingonit
2.**Readthedocs**-Understandthearchitectureanddesigndecisions
3.**Askquestions**-Openadiscussionifunsure

---

##DevelopmentSetup

###Prerequisites

-**Node.js**:20.xorlater
-**npm**:10.xorlater
-**Git**:2.xorlater

###CloneandInstall

```bash
#Clonetherepository
gitclonehttps://github.com/yourorg/udb.git
cdudb

#Installrootdependencies
npminstall

#Installcomponentdependencies
npminstall--prefixcli
npminstall--prefixclient
npminstall--prefixprotocol
npminstall--prefixdaemon/linux
```

###ProjectStructure

```
udb/
├──cli/#Command-lineinterface
├──client/#JavaScriptclientlibrary
├──protocol/#Wireprotocolimplementation
├──daemon/#Devicedaemonimplementations
│├──linux/#FullLinuxdaemon
│├──mcu/#Microcontrollerdaemon
│└──simulator/#Testsimulator
├──transport/#Transportlayerabstractions
├──auth/#Authenticationmodules
├──scripts/#Buildandutilityscripts
├──ci/#CI/CDconfigurations
├──docs/#Documentation
└──examples/#Usageexamples
```

###RunningTests

```bash
#Runalltests
npmtest

#Runspecifictestfile
node--testprotocol/src/messages.test.js

#Runwithverboseoutput
npmtest----test-reporter=spec

#Runsmoketests(CIvalidation)
nodeci/smoke-test.js
```

###BuildingBinaries

```bash
#Buildforcurrentplatform
npmrunbuild

#Buildforallplatforms
npmrunbuild:all
```

---

##HowtoContribute

###ReportingBugs

Createanissuewith:

1.**Title**:Clear,concisesummary
2.**Environment**:OS,Node.jsversion,UDBversion
3.**StepstoReproduce**:Minimalstepstotriggerthebug
4.**ExpectedBehavior**:Whatshouldhappen
5.**ActualBehavior**:Whatactuallyhappens
6.**Logs/Output**:Errormessages,stacktraces

###SuggestingFeatures

Openadiscussion(notissue)with:

1.**ProblemStatement**:Whatproblemdoesthissolve?
2.**ProposedSolution**:Howwoulditwork?
3.**Alternatives**:Whatelsedidyouconsider?
4.**Scope**:IsthisaCLI,client,orprotocolchange?

###WritingCode

1.**Fork**therepository
2.**Createabranch**from`main`:`gitcheckout-bfix/issue-123`
3.**Makechanges**followingcodingstandards
4.**Addtests**fornewfunctionality
5.**Runtests**toensurenothingbreaks
6.**Commit**withclearmessages
7.**Push**andopenapullrequest

---

##PullRequestProcess

###PRRequirements

-[]Alltestspass
-[]Codefollowsstyleguidelines
-[]Documentationupdated(ifapplicable)
-[]Commitmessagesareclear
-[]Nounrelatedchangesincluded

###PRTitleFormat

```
<type>(<scope>):<description>

Types:feat,fix,docs,style,refactor,test,chore
Scopes:cli,client,protocol,daemon,transport,auth
```

Examples:
-`feat(cli):add--timeoutflagtoexeccommand`
-`fix(client):handleconnectiontimeoutcorrectly`
-`docs:updateAPIexamplesforpush/pull`

###ReviewProcess

1.**Automatedchecks**run(tests,linting)
2.**Maintainerreview**within1week
3.**Addressfeedback**ordiscussalternatives
4.**Approvalandmerge**bymaintainer

###MergeStrategy

-**Squashmerge**formostPRs(cleanhistory)
-**Mergecommit**forlargefeatureswithmeaningfulcommits
-**Rebase**rarely,forverycleansingle-commitchanges

---

##CodingStandards

###JavaScriptStyle

Wefollowaminimal,consistentstyle:

```javascript
//UseESmodules
importfsfrom"node:fs";

//Preferconst,useletwhenneeded,nevervar
constconfig=loadConfig();
letcounter=0;

//Useasync/awaitoverrawpromises
asyncfunctionfetchData(){
constresult=awaitclient.exec("command");
returnresult;
}

//Useexplicitcomparisons
if(value===null){...}
if(items.length===0){...}

//Errorhandlingwithspecifictypes
try{
awaitriskyOperation();
}catch(err){
if(err.code==='ECONNREFUSED'){
thrownewConnectionError(address,err);
}
throwerr;
}
```

###NamingConventions

|Element|Convention|Example|
|---------|-----------|---------|
|Files|kebab-case|`device-manager.js`|
|Functions|camelCase|`connectDevice()`|
|Classes|PascalCase|`DeviceConnection`|
|Constants|SCREAMING_SNAKE|`DEFAULT_TIMEOUT`|
|Private|underscoreprefix|`_internalState`|

###ErrorHandling

-Throwspecificerrortypes(see`client/src/index.js`)
-Includecontextinerrormessages
-Useerrorcodesforprogrammatichandling
-Neverswallowerrorssilently

###Comments

```javascript
//Good:ExplainsWHY
//Retrywithbackofftohandletransientnetworkissues
awaitretry(connect,{maxAttempts:3,backoff:1000});

//Bad:ExplainsWHAT(obviousfromcode)
//Incrementcounterby1
counter++;
```

---

##Testing

###TestFramework

WeuseNode.jsbuilt-intestrunner:

```javascript
import{describe,it,beforeEach,mock}from"node:test";
importassertfrom"node:assert";

describe("MyModule",()=>{
beforeEach(()=>{
//Setup
});

it("shoulddosomething",async()=>{
constresult=awaitmyFunction();
assert.strictEqual(result,expected);
});
});
```

###TestCategories

|Category|Location|Purpose|
|----------|----------|---------|
|Unit|`*.test.js`nexttosource|Testindividualfunctions|
|Integration|`test/integration/`|Testcomponentinteraction|
|Smoke|`ci/smoke-test.js`|QuickvalidationforCI|

###CoverageGoals

-**Protocol**:100%coverage(criticalpath)
-**Client**:90%+coverage
-**CLI**:80%+coverage(testedviasmoketests)
-**Daemon**:80%+coverage

---

##Documentation

###WhatNeedsDocs

-AllpublicAPIs
-CLIcommandsandflags
-Configurationoptions
-Protocolchanges
-Architecturedecisions

###DocumentationLocations

|Type|Location|
|------|----------|
|APIReference|`client/API.md`|
|CLIReference|`cli/src/udb.js`(--help)|
|Architecture|`docs/architecture.md`|
|Protocol|`protocol/spec.md`|
|Examples|`examples/`|

###DocStyle

-Usepresenttense("Returns..."not"Willreturn...")
-Includecodeexamples
-Keepexamplesminimalbutcomplete
-UpdatedocsinthesamePRascodechanges

---

##ReleaseProcess

###Versioning

Wefollow[SemanticVersioning](https://semver.org/):

-**MAJOR**:Breakingchanges
-**MINOR**:Newfeatures(backwardcompatible)
-**PATCH**:Bugfixes

###ReleaseSteps(Maintainers)

1.Update`CHANGELOG.md`
2.Updateversionin`package.json`
3.Commit:`chore:releasev0.5.0`
4.Tag:`gittagv0.5.0`
5.Push:`gitpushoriginmain--tags`
6.GitHubActionsbuildsandpublishes

###Pre-releaseVersions

Fortestingbeforestablerelease:

```bash
#Beta
npmversion0.5.0-beta.1

#Releasecandidate
npmversion0.5.0-rc.1
```

---

##Governance

###DecisionMaking

|DecisionType|Process|
|--------------|---------|
|Bugfixes|Maintainerdiscretion|
|Minorfeatures|Issuediscussion+maintainerapproval|
|Majorfeatures|RFCinDiscussions+consensus|
|Breakingchanges|RFC+2-weekcommentperiod|
|Protocolchanges|RFC+extensivereview+FROZENafterv1|

###RFCProcess

Forsignificantchanges:

1.OpenaDiscussionwith`[RFC]`prefix
2.Describetheproposalindetail
3.Gathercommunityfeedback(minimum1week)
4.Addressconcernsanditerate
5.Maintainermakesfinaldecision
6.Documentdecisionin`docs/decisions/`

###Maintainers

Currentmaintainers:

-TBD(Updatewithactualmaintainers)

Maintainersareresponsiblefor:
-ReviewingandmergingPRs
-Triagingissues
-Makingreleasedecisions
-Enforcingcodeofconduct

###BecomingaMaintainer

Regularcontributorsmaybeinvitedtobecomemaintainersbasedon:
-Qualityofcontributions
-Communityengagement
-Alignmentwithprojectvalues
-Timeavailability

---

##License

Bycontributing,youagreethatyourcontributionswillbelicensedundertheproject'slicense(see[LICENSE](LICENSE)).

---

##Questions?

-**Generalquestions**:OpenaDiscussion
-**Bugreports**:OpenanIssue
-**Securityissues**:See[SECURITY.md](SECURITY.md)

Thankyouforcontributing!🙏
