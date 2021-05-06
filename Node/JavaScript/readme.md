# Instructions for using the Azure IoT Node.js SDK to write an IoT Central high availability device client using JavaScript

Azure IoT Node.js SDK: https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/Node/JavaScript 

&nbsp;
## Prerequisite

Read the repositories root [README](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/README.md) file to understand what this sample is for and what advantages IoT Central's high availability feature provides. 

&nbsp;
## What you need to edit before running this code

NOTE: You should have a fork of this repository, or copy and use the source files independently in your own samples. Adding secrets to code is not recommended and opens the opportunity to accidentally check-in code with the secrets to GitHub.

Change the following code to add in your scope id and group SAS key from the IoT Central application.  Both can be found in the Administration -> Device connection page.

``` JavaScript
// device settings - FILL IN YOUR VALUES HERE
const scopeId = "<Put your scope id here from IoT Central Administration -> Device connection>"
const groupSymmetricKey = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>"
```

Optionally the following section can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` JavaScript
// optional device settings - CHANGE IF DESIRED/NECESSARY
const provisioningHost = "global.azure-devices-provisioning.net"
const deviceId = "failover_js"
const modelId = "dtmi:Sample:Failover;1"  // This model is available in the root of the Github repo (Failover.json) and can be imported into your Azure IoT central application
```
It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section:

``` JavaScript
// test setting flags
const telemetrySendOn = true
const reportedPropertySendOn = true
const desiredPropertyReceiveOn = true
const directMethodReceiveOn = true
const c2dCommandReceiveOn = true
```

&nbsp;
## Running the Sample

1. This sample requires Node 14.16.1 LTS or higher to run, check the version of node you are running with the command:

``` shell
node --version
```

If you do not have Node 14.16.1 LTS or higher please install the correct version for your operating system from https://nodejs.org/en/.

2. Install the necessary libraries for this sample using the Node package manager *npm*.  Use the following command from the same directory as the *package-lock.json* file:

``` shell
npm install
```
3. Run the sample with the following command (from the same directory as failover.js):

``` shell
node failover.js
```
4. To cleanly terminate and disconnect from IoT Central press Ctrl-C whilst the application is running to clean up and exit

