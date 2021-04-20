# Instructions for using the Azure IoT C SDK to write an IoT Central high availability device client

Azure IoT C SDK: https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/C  

&nbsp;
## Prerequisite

Read the repositories root [README](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/README.md) file to understand what this sample is for and what advantages IoT Central's high availability feature provides. 

&nbsp;
## What you need to edit before running this code

Change the following code to add in your scope id and group SAS key from the IoT Central application.  Both can be found in the Administration -> Device connection page.

``` C
// device settings - FILL IN YOUR VALUES HERE
#define SCOPE_ID "<Put your scope id here from IoT Central Administration -> Device connection>";
#define GROUP_SYMMETRIC_KEY "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>";
```

Optionally the following section can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` C
// optional device settings - CHANGE IF DESIRED/NECESSARY
#define DEVICE_ID "failover_c"
#define GLOBAL_PROVISIONING_URI "global.azure-devices-provisioning.net"
#define MODEL_ID "dtmi:Sample:Failover;1"
```
It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section:

``` C
// test setting flags
static bool telemetrySendOn = true;
static bool reportedPropertySendOn = true;
static bool desiredPropertyReceiveOn = true;
static bool directMethodReceiveOn = true;
static bool c2dCommandReceiveOn = true;
```

&nbsp;
## Running the Sample

The easiest way to run this sample is to inject this project into the SDK provisioning_client/samples directory.  Follow these instructions to compile and run this sample on Windows.  For Linux and MacOS follow the respective instructions in the Azure C SDK for building the SDK and then start at instruction 3. below.

1. Clone the Azure IoT C SDK from here https://github.com/Azure/azure-iot-sdk-c
2. Follow the instruction at https://github.com/Azure/azure-iot-sdk-c/blob/master/doc/devbox_setup.md#windows for getting your Windows development environment setup.  We will be building the C SDK with CMake on Windows so follow that path in the instructions (ignore the vcpkg instructions)
3. Copy the folder 'iot_central_failover_sample' from here to '<where you cloned the Azure C SDK>\azure-iot-sdk-c\provisioning_client\samples\'
4. copy the 'CMakeLists.txt' in the C folder here to '<where you cloned the Azure C SDK>\azure-iot-sdk-c\provisioning_client\samples\' replacing the one that is there currently
5. from the command line go to the directory you cloned the Azure C SDK and run:

```
cd azure-iot-sdk-c
cd cmake
# Either
  cmake .. -G "Visual Studio 15 2017" ## For Visual Studio 2017
# or
  cmake .. -G "Visual Studio 16 2019" -A Win32
```

6. Now when you open the solution azure_iot_sdks.sln you should see the iot_central_failover_sample in the Solution Explorer under the Provision_samples folder.  Right click the iot_central_failover_sample in Solution Explorer and click *Set as Startup Project*.  Now you can build this project and run it.
7. Once the sample is running you can cleanly exit by pressing the ESC key to terminate all active threads, close the connection to IoT Central and exit the program.