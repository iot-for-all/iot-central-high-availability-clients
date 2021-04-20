# Instructions for using the Azure IoT CSharp SDK to write an IoT Central high availability device client

Azure IoT CSharp SDK: https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/csharp

&nbsp;
## Prerequisite

Read the repositories root [README](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/README.md) file to understand what this sample is for and what advantages IoT Central's high availability feature provides. 

&nbsp;
## What you need to edit before running this code

Change the following code to add in your scope id and group SAS key from the IoT Central application.  Both can be found in the Administration -> Device connection page.

``` csharp
// device settings - FILL IN YOUR VALUES HERE
private static string scopeId = "<Put your scope id here from IoT Central Administration -> Device connection>";
private static string groupSymmetricKey = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>";
```

Optionally the following section can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` csharp
// optional device settings - CHANGE IF DESIRED/NECESSARY
private static string deviceId = "failover3_cs";
private static string globalDeviceEndpoint = "global.azure-devices-provisioning.net";
private static string modelId = "dtmi:Sample:Failover;1";
```
It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section:

``` csharp
// test setting flags
private static bool telemetrySendOn = true;
private static bool reportedPropertySendOn = true;
private static bool desiredPropertyReceiveOn = true;
private static bool directMethodReceiveOn = true;
private static bool c2dCommandReceiveOn = true;
```

&nbsp;
## Running the Sample

1. This sample requires .NET Core SDK 3.0.0 or higher to run, check the version of node you are running with the command:

``` shell
dotnet --version
```

If you do not have .NET Core SDK 3.0.0 or higher please install the correct version for your operating system from https://dotnet.microsoft.com/download

2. Install the necessary libraries for this sample using .Net core.  Use the following command from the same directory as the *failover.csproj* file:

``` shell
dotnet restore
```
3. Run the sample with the following command (from the same directory as failover.cs):

``` shell
dotnet run
```
4. To cleanly terminate and disconnect from IoT Central press the ESC key whilst the application is running to clean up and exit
