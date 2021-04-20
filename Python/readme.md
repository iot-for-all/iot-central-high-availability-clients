# Instructions for using the Azure IoT Python SDK to write an IoT Central high availability device client

Azure IoT Python SDK: https://github.com/iot-for-all/iot-central-high-availability-clients/tree/main/Python

&nbsp;
## Prerequisite

Read the repositories root [README](https://github.com/iot-for-all/iot-central-high-availability-clients/blob/main/README.md) file to understand what this sample is for and what advantages IoT Central's high availability feature provides. 

&nbsp;
## What you need to edit before running this code

Change the following code to add in your scope id and group SAS key from the IoT Central application.  Both can be found in the Administration -> Device connection page.

``` Python
# device settings - FILL IN YOUR VALUES HERE
scope_id = "<Put your scope id here from IoT Central Administration -> Device connection>"
group_symmetric_key = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>"
```

Optionally the following section can also be modified if you need to use a different DPS endpoint (uncommon) or wish to use a different device or model identity:

``` Python
# optional device settings - CHANGE IF DESIRED/NECESSARY
provisioning_host = "global.azure-devices-provisioning.net"
device_id = "failover_py"
model_id = "dtmi:Sample:Failover;1"  # This model is available in the root of the Github repo (Failover.json) and can be imported into your Azure IoT central application
```
It is also possible to turn off different actions in the sample for debugging purposes by adjusting the following section:

``` Python
# test setting flags
telemetry_send_on = True
reported_property_send_on = True
desired_property_receive_on = True
direct_method_receive_on = True
c2d_command_receive_on = True
```

&nbsp;
## Running the Sample

1. This sample requires Python 3.7+ to run, check the version of python you are running with the command:

``` shell
python --version
```
*or*
``` shell
python3 --version
```
If you do not have Python 3.7 or higher please install the correct version for your operating system.

2. Install the necessary libraries for this sample using the Python package manager *pip*.  Use the following commands:

``` shell
pip install asyncio
pip install azure-iot-device
```
3. Run the sample with the following command (from the same directory as failover.py):

``` shell
python failover.py
```
*or*
``` shell
python3 failover.py
``` 
