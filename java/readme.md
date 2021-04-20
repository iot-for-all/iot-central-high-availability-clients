# Instructions for using the Azure IoT Java SDK to write an IoT Central high availability device client

Azure IoT Java SDK: https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/java 

&nbsp;
## Prerequisite

Read the repositories root [README](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/README.md) file to understand what this sample is for and what advantages IoT Central's high availability feature provides. 

&nbsp;
## What you need to edit before running this code

Change the following code to add in your scope id and group SAS key from the IoT Central application.  Both can be found in the Administration -> Device connection page.

``` java
// Device settings - FILL IN YOUR VALUES HERE
private static final String SCOPE_ID = "<Put your scope id here from IoT Central Administration -> Device connection>";
private static final String ENROLLMENT_GROUP_SYMMETRIC_KEY = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>";
```

Optionally the following section can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` java
// Optional device settings - CHANGE IF DESIRED/NECESSARY
private static final String GLOBAL_ENDPOINT = "global.azure-devices-provisioning.net";
private static final String PROVISIONED_DEVICE_ID = "failover_java";
private static final String MODEL_ID = "dtmi:Sample:Failover;1";
```
It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section:

``` java
// test setting flags
private static final boolean telemetrySendOn = true;
private static final boolean reportedPropertySendOn = true;
private static final boolean desiredPropertyReceiveOn = true;
private static final boolean directMethodReceiveOn = true;
private static final boolean c2dCommandReceiveOn = true;
```

&nbsp;
## Running the Sample

1. This sample requires Java SE 8 or higher to run, check the version of node you are running with the command:

``` shell
java --version
```

If you do not have Java SE 8 or higher please install the correct version for your operating system from https://dotnet.microsoft.com/download

2. You are also going to need to have Maven 3 installed for package management and building.  Install Maven from https://maven.apache.org/download.cgi if the version command does not show version 3

``` shell
mvn --version
```

2. The install of libraries, compilation and assembly of the jar file are handled with a single command run from the same directory as the **pom.xml** file:

``` shell
mvn clean compile assembly:single
```
3. Run the sample with the following command (from the same directory as the **pom.xml** file):

``` shell
java -jar .\target\failover-1.0-jar-with-dependencies.jar
```
4. To cleanly terminate and disconnect from IoT Central press the **q** or **Q** key followed by the **enter** key whilst the application is running to clean up and exit
