---
page_type: sample
name: "IoT Central high availability client samples"
description: "Sample code for IoT Central device clients that shows how to handle failover scenarios."
languages:
- c
- csharp
- java
- nodejs
- python
products:
- azure-iot-central
urlFragment: iotc-high-availability-clients
---

# IoT Central high availability client samples

Coding Azure IoT devices to work with IoT Centrals high availability feature.  Each folder in this repository contains a full device client sample that illustrates how to code a high availability device client for use with IoT Central.

Ask yourself is your IoT Central device ready for this kind of disaster:

![giant lizard attack](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/assets/disaster.jpg)

## What is this high-availability thing?
The high availability option in IoT Central allows for an application to have two or more IoT Hubs associated with it in different locations.  This allows for one hub to have a failure and devices will continue to be available and operate against the other IoT Hub.  The magic ingredient in this is the Device Provisioning Service (DPS) that acts as a traffic cop directing your device to the correct IoT Hub to connect and send data to.  Lets look at a failover scenario.

In this scenario we have an IoT Central application that has two hubs 'A' and 'B' and a device named 'XYZ'.  We will connect the device and then see what happens when one of the hubs fails due to a giant lizard attack (you may have seen the movie!) on that data center.

* Device 'XYZ' starts up and registers itself with DPS and is directed to connect to Iot Hub 'A'
* Device connects to IoT Hub 'A' and starts sending telemetry and operating normally
* Giant lizard attacks the data center where IoT Hub A resides and knocks out power to the data center
* Device 'XYZ' gets a socket disconnect from IoT Hub 'A' and must now handle the disconnect
* Device 'XYZ' returns back to DPS and asks where should I connect to, DPS knows that 'A' is unavailable and returns back 'B' as the IoT Hub to connect to (this is what we call failover)
* Device 'XYZ' connects to IoT Hub 'B' and continues to send it's telemetry and operate normally
* The attacked data center regains power and brings IoT Hub 'A' back online and device load is distributed back across the two IoT Hubs.  If device 'XYZ' is moved back to IoT Hub 'A' then it will be disconnected from IoT Hub 'B' and once again returns to DPS to be redirected back to IoT Hub 'A' (this is what we call failback)
* Device 'XYZ' reconnects to IoT Hub 'A' and continues sending telemetry and operating normally
* throughout this giant lizard disaster no data was lost and your device and IoT Central application continue to operate normally

## Directory structure

| Folder Name | Azure IoT device SDK                         | Folder Link                                                                         |
|-------------|----------------------------------------------|-------------------------------------------------------------------------------------|
|C            |https://github.com/Azure/azure-iot-sdk-c      |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/C     |
|Node/JavaScript         |https://github.com/Azure/azure-iot-sdk-node   |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/Node/JavaScript  |
|Node/TypeScript         |https://github.com/Azure/azure-iot-sdk-node   |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/Node/TypeScript  |
|Python       |https://github.com/Azure/azure-iot-sdk-python |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/Python|
|CSharp       |https://github.com/Azure/azure-iot-sdk-csharp |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/csharp|
|Java         |https://github.com/Azure/azure-iot-sdk-java   |https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/java  |

## Functionality of the client

Each of the samples has the exact same functionality coded using the same IoT Central device template.  The device template can be found in the file [failover.json](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/Failover.json).  This can be imported into your IoT Central application and each of the samples will associate itself with this model by default.

The functionality of each sample is:

* Connect to IoT Central using DPS using the group symmetric SAS token (device first registration)
* Handles disconnect and failover to an alternate IoT Hub via DPS
* Sending telemetry on a set period
* Sending reported properties on a set period
* Handles direct method commands
* Handles C2D commands
* Handles desired properties from IoT Central and acknowledge the receipt
* Disconnects cleanly
* Written using MQTT transport

All samples all have a section that looks like this (this is the Node.js version):

``` JavaScript
// device settings - FILL IN YOUR VALUES HERE
const scopeId = "<Put your scope id here from IoT Central Administration -> Device connection>"
const groupSymmetricKey = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>"
```

This information needs to be filled in before running the sample.  Optionally the following section (taken from Node.js sample) can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` JavaScript
// optional device settings - CHANGE IF DESIRED/NECESSARY
const provisioningHost = "global.azure-devices-provisioning.net"
const deviceId = "failover_js"
const modelId = "dtmi:Sample:Failover;1"  // This model is available in the root of the Github repo (Failover.json) and can be imported into your Azure IoT central application
```

It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section (taken from the Node.js sample):

``` JavaScript
// test setting flags
const telemetrySendOn = true
const reportedPropertySendOn = true
const desiredPropertyReceiveOn = true
const directMethodReceiveOn = true
const c2dCommandReceiveOn = true
```

Each of the sample folders contains a readme that discusses running the sample and includes the above information specific to that sample and the programming language used.

## Testing failover and failback scenarios

We are unable to predict when the next giant lizard attack will happen and to which data center so we have provided you with your own virtual giant lizard to test failover scenarios.  The IoT Central development team has updated the Azure Command Line Interface (CLI) extension for IoT Central so you can force a device to either fail-over or fail-back from one IoT Hub to another.

To install the Azure CLI tool please see this link https://docs.microsoft.com/en-us/cli/azure/install-azure-cli  Once installed you can install the latest IoT Central extension by following the instructions here https://github.com/Azure/azure-iot-cli-extension

Once installed you can force your device to failover with the following command:

``` shell
az iot central device manual-failover -n <IoT Central application id> -d <device id> --central-api-uri <application host name> --central-dns-suffix <application DNS suffix name>
```

|Parameter                   | Description                                                                      | Example                             |
|----------------------------|----------------------------------------------------------------------------------|-------------------------------------|
|IoT Central application id  |You can find this in your IoT Central application in the Administration main page |8ed0b52f-75f9-4964-9287-008159218877 |
|device id                   |This is the device identity for the device you wish to failover                   |failover_device                      |
|application host name       |The first part of the URL of your IoT Central application (before the first dot)  |mycentralapp                         |
|application DNS suffix name |The rest of the URL of your IoT Central application (after the first dot)         |azureiotcentral.com                  |

The output from the command should look like this:

``` shell
Command group 'iot central device' is in preview and under development. Reference and support levels: https://aka.ms/CLI_refstatus
{
  "hubIdentifier": "d3936bfa327fe0dbdf65d2cf9c5f521a1807bd8972d8d7212165a65d8af73c71",
  "message": "Success! This device is now being failed over. You can check your device’s status using 'iot central device registration-info' command. The device will revert to its original hub at Mon, 19 Apr 2021 21:04:46 GMT. You can choose to failback earlier using device-manual-failback command. Learn more: https://aka.ms/iotc-device-test"
}
```

When a device is failed over to it's other IoT Hub it will remain failed over for a period of five minutes.  After which it will fail-back to it's original hub.  You can force the device to fail-back before the five minutes are up by issuing the following command:

``` shell
az iot central device manual-failback -n <IoT Central application id> -d <device id> --central-api-uri <application host name> --central-dns-suffix <application DNS suffix name>
```

The parameters are exactly the same as for the previous fail-over command above.  The output from the command should look similar to this:

``` shell
Command group 'iot central device' is in preview and under development. Reference and support levels: https://aka.ms/CLI_refstatus
{
  "hubIdentifier": "d3936bfa327fe0dbdf65d2cf9c5f521a1807bd8972d8d7212165a65d8af73c71",
  "message": "Device has successfully failed back to its original hub"
}
```

A couple of batch (.bat) files are provided in the root of the this repository *failover.bat* and *failback.bat* as a convenience and take the following four parameters (exactly the same as the command description above):

|Parameter                   | Description                                                                      | Example                             |
|----------------------------|----------------------------------------------------------------------------------|-------------------------------------|
|IoT Central application id  |You can find this in your IoT Central application in the Administration main page |8ed0b52f-75f9-4964-9287-008159218877 |
|device id                   |This is the device identity for the device you wish to failover                   |failover_device                      |
|application host name       |The first part of the URL of your IoT Central application (before the first dot)  |mycentralapp                         |
|application DNS suffix name |The rest of the URL of your IoT Central application (after the first dot)         |azureiotcentral.com                  |


## Final thoughts

In all these examples there is no code to optimize connection speed, all connections are routed through DPS.  In a real device it might be more optimal to cache the hostname returned from DPS and when disconnected from the IoT Hub attempt to connect using the cached hostname, if the connection fails at that point drop back to DPS for a new hostname and cache it.  This optimization will reduce the connection time and remove the performacne penalty when the connection drops for various reasons outside of an IoT Hub failure.

Please let us know if you find any errors or have suggestions to improve the code in this repository.  Finally, good luck and be on the look out for for giant lizard attacks!

