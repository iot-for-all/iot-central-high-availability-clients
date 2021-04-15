# Instructions for running this sample

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