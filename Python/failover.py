import asyncio
import base64
import hmac
import hashlib
import random

from azure.iot.device.aio import ProvisioningDeviceClient
from azure.iot.device.aio import IoTHubDeviceClient
from azure.iot.device import Message
from azure.iot.device import MethodResponse
from azure.iot.device import exceptions

# device settings - FILL IN YOUR VALUES HERE
scope_id = "<Put your scope id here from IoT Central Administration -> Device connection>"
group_symmetric_key = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>"

# optional device settings - CHANGE IF DESIRED/NECESSARY
provisioning_host = "global.azure-devices-provisioning.net"
device_id = "failover_py"
model_id = "dtmi:Sample:Failover;1"  # This model is available in the root of the Github repo (Failover.json) and can be imported into your Azure IoT central application

# test setting flags
telemetry_send_on = True
reported_property_send_on = True
desired_property_receive_on = True
direct_method_receive_on = True
c2d_command_receive_on = True

# adjustable times and timeouts
await_timeout = 4.0
yield_time = 1.0
connection_monitor_sleep = 1.0

# general purpose variables
use_websockets = True
device_client = None
terminate = False
trying_to_connect = False
max_connection_attempt = 3

# derives a symmetric device key for a device id using the group symmetric key
def derive_device_key(device_id, group_symmetric_key):
    message = device_id.encode("utf-8")
    signing_key = base64.b64decode(group_symmetric_key.encode("utf-8"))
    signed_hmac = hmac.HMAC(signing_key, message, hashlib.sha256)
    device_key_encoded = base64.b64encode(signed_hmac.digest())
    return device_key_encoded.decode("utf-8")

# coroutine that sends telemetry on a set frequency until terminated
async def send_telemetry(send_frequency):
    while not terminate:
        if device_client and device_client.connected:
            payload = '{"temp": %f, "humidity": %f}' % (random.randrange(60.0, 95.0), random.randrange(10.0, 100.0))
            print("sending message: %s" % (payload))
            msg = Message(payload)
            msg.content_type = "application/json"
            msg.content_encoding = "utf-8"
            try:
                await asyncio.wait_for(device_client.send_message(msg), timeout=await_timeout)
                print("completed sending message")
            except asyncio.TimeoutError:
                continue
            await asyncio.sleep(send_frequency)  # sleep until it's time to send again
        else:
            await asyncio.sleep(yield_time)  # do this to yield the busy loop or you will block all other tasks


# coroutine that sends reported properties on a set frequency until terminated
async def send_reportedProperty(send_frequency):
    while not terminate:
        if device_client and device_client.connected:
            reported_payload = {"battery": random.randrange(0.0, 100.0)}
            print("Sending reported property: {}".format(reported_payload))
            try:
                await asyncio.wait_for(device_client.patch_twin_reported_properties(reported_payload), timeout=await_timeout)
            except asyncio.TimeoutError:
                continue
            await asyncio.sleep(send_frequency)  # sleep until it's time to send again
        else:
            await asyncio.sleep(yield_time) # do this to yield the busy loop or you will block all other tasks



# handles desired properties from IoT Central (or hub) until terminated
async def desired_property_handler(patch):
    print("Desired property received, the data in the desired properties patch is: {}".format(patch))
    # acknowledge the desired property back to IoT Central
    key = list(patch.keys())[0]
    if list(patch.keys())[0] == "$version":
        key = list(patch.keys())[1]

    reported_payload = {key:{"value": patch[key], "ac":200, "ad":"completed", "av":patch['$version']}}
    print(reported_payload)
    await asyncio.wait_for(device_client.patch_twin_reported_properties(reported_payload), timeout=await_timeout)


# handles direct methods from IoT Central (or hub) until terminated
async def direct_method_handler(method_request):
    print("executing direct method: %s(%s)" % (method_request.name, method_request.payload))
    method_response = None
    if method_request.name == "echo":
        # send response - echo back the payload
        method_response = MethodResponse.create_from_method_request(method_request, 200, method_request.payload)
    else:
        # send bad request status code
        method_response = MethodResponse.create_from_method_request(method_request, 400, "unknown command")
    await asyncio.wait_for(device_client.send_method_response(method_response), timeout=await_timeout)


# handles the Cloud to Device (C2D) messages until terminated
async def c2d_message_handler(message):
    if message.custom_properties['method-name'] == 'setAlarm':
        data_str = message.data.decode('utf-8')
        print('C2D command received:')
        print('\tSetting an alarm for ' + data_str)
    else:
        print("the data in the message received was ")
        print(message.data)
        print("custom properties are")
        print(message.custom_properties)
        print("content Type: {0}".format(message.content_type))
        print("")
        

# coroutine to monitor the connection to see if we need to reconnect
async def monitor_connection():
    global device_client, terminate

    while not terminate:
        if not trying_to_connect and not device_client.connected:
            device_client = None
            if not await connect():
                print('Cannot connect to Azure IoT Central please check the application settings and machine connectivity')
                print('Terminating all running tasks and exiting ...')
                terminate = True
        await asyncio.sleep(connection_monitor_sleep)


# connect is not optimized for caching the IoT Hub hostname so all connects go through Device Provisioning Service (DPS)
# a strategy here would be to try just the hub connection using a cached IoT Hub hostname and if that fails fall back to a full DPS connect
async def connect():
    global device_client

    trying_to_connect = True
    device_symmetric_key = derive_device_key(device_id, group_symmetric_key)

    connection_attempt_count = 0
    connected = False
    while not connected and connection_attempt_count < max_connection_attempt:
        provisioning_device_client = ProvisioningDeviceClient.create_from_symmetric_key(
            provisioning_host=provisioning_host,
            registration_id=device_id,
            id_scope=scope_id,
            symmetric_key=device_symmetric_key,
            websockets=use_websockets
        )

        provisioning_device_client.provisioning_payload = '{"iotcModelId":"%s"}' % (model_id)
        registration_result = None

        try:
            registration_result = await provisioning_device_client.register()
        except (exceptions.CredentialError, exceptions.ConnectionFailedError, exceptions.ConnectionDroppedError, exceptions.ClientError, Exception) as e:
            print("DPS registration exception: " + e)
            connection_attempt_count += 1

        if registration_result.status == "assigned":
            dps_registered = True

        if dps_registered:
            device_client = IoTHubDeviceClient.create_from_symmetric_key(
                symmetric_key=device_symmetric_key,
                hostname=registration_result.registration_state.assigned_hub,
                device_id=registration_result.registration_state.device_id,
                websockets=use_websockets
            )

        try:
            if desired_property_receive_on:
                device_client.on_twin_desired_properties_patch_received = desired_property_handler
            if direct_method_receive_on:
                device_client.on_method_request_received = direct_method_handler
            if c2d_command_receive_on:
                device_client.on_message_received = c2d_message_handler

            await device_client.connect()
            trying_to_connect = False
            connected = True



        except Exception as e:
            print("Connection failed, retry %d of %d" % (connection_attempt_count, max_connection_attempt))
            connection_attempt_count += 1

    return connected


async def main():
    random.seed()

    if await connect():
        # start the tasks if the task flag is set to on
        tasks = []
        if telemetry_send_on:
            tasks.append(asyncio.create_task(send_telemetry(5))) # send telemetry
        if reported_property_send_on:
            tasks.append(asyncio.create_task(send_reportedProperty(15))) # send reported property

        tasks.append(asyncio.create_task(monitor_connection()))  # task to monitor for disconnects and perform reconnect

        #await the tasks ending before exiting
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            pass # ignore the cancel actions on twin_listener and direct_method_listener

        # finally, disconnect
        print("Disconnecting from IoT Hub")
        await device_client.disconnect()
    else:
        print('Cannot connect to Azure IoT Central please check the application settings and machine connectivity')

# start the main routine
if __name__ == "__main__":
    loop = asyncio.run(main())

    # If using Python 3.6 or below, use the following code instead of asyncio.run(main()):
    # loop = asyncio.get_event_loop()
    # loop.run_until_complete(main())
    # loop.close()