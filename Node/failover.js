'use strict';

// Azure IoT Device SDK
const Protocol  = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const  ExponentialBackOffWithJitter = require('azure-iot-common').ExponentialBackOffWithJitter;

// Azure IoT DPS SDK
const ProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;

// Crypto SDK needed for computing device keys
const crypto = require('crypto');

// device settings - FILL IN YOUR VALUES HERE
const scopeId = "<Put your scope id here from IoT Central Administration -> Device connection>"
const groupSymmetricKey = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>"

// optional device settings - CHANGE IF DESIRED/NECESSARY
const provisioningHost = "global.azure-devices-provisioning.net"
const deviceId = "failover_js"
const modelId = "dtmi:Sample:Failover;1"  // This model is available in the root of the Github repo (Failover.json) and can be imported into your Azure IoT central application

// test setting flags
const telemetrySendOn = true
const reportedPropertySendOn = true
const desiredPropertyReceiveOn = true
const directMethodReceiveOn = true
const c2dCommandReceiveOn = true

// general purpose variables
let client = null;
let deviceTwin = null;
let connected = false;

// calculate the device key using the symetric group key
function computeDerivedSymmetricKey(masterKey, deviceId) {
    return crypto.createHmac('SHA256', Buffer.from(masterKey, 'base64'))
      .update(deviceId, 'utf8')
      .digest('base64');
}

// Azure IoT Central custom retry policy derived from ExponentialBackOffWithJitter
class MultiHubRetryPolicy extends ExponentialBackOffWithJitter {
    constructor(...args) {
        super(...args);
    }

    shouldRetry(err) { 
        if (err.message === 'Connection refused: Server unavailable')
           return false; // if hub not available stop retry and fall back to DPS
        else
            return super.shouldRetry(err);
    }

    nextRetryTimeout(retryCount, throttled) {
        return super.nextRetryTimeout(retryCount, throttled);
    }
}

// handler for C2D message
function messageHandler(msg) {
    let methodName = msg.properties.propertyList.find(o => o.key === 'method-name');
    // is this the setAlarm C2D message
    if (methodName != null && methodName.value === 'setAlarm') {
        console.log(`C2D method: ${methodName.value}(${msg.data.toString('utf-8')})`)
    }
}

// connect to IoT Central/Hub via Device Provisioning Servicee (DPS)
async function connect() {
    return new Promise((myResolve, myReject) => {
        // calc device symmetric key from group symmetric key
        const deviceSymmetricKey = computeDerivedSymmetricKey(groupSymmetricKey, deviceId);
        
        // DPS provision with device symmetric key
        const provisioningSecurityClient = new SymmetricKeySecurityClient(deviceId, deviceSymmetricKey);
        const provisioningClient = ProvisioningDeviceClient.create(provisioningHost, scopeId, new ProvisioningTransport(), provisioningSecurityClient);

        // set the model to register against
        provisioningClient.setProvisioningPayload(`{"iotcModelId":"${modelId}"}`)

        // register the device and get the hub host name
        provisioningClient.register(function(err, result) {
            if (err) {
                console.log("error registering device: " + err);
                throw new Error(`Registration error! Error: ${err.Message}`);
            } else {
                console.log('registration succeeded');
                console.log(`assigned hub: ${result.assignedHub}`);
                console.log(`deviceId: ${result.deviceId}`);
                const connectionString = `HostName=${result.assignedHub};DeviceId=${result.deviceId};SharedAccessKey=${deviceSymmetricKey}`;

                // create client from connection string
                client = Client.fromConnectionString(connectionString, Protocol);
                
                // cannot use the default retry logic built into the SDK as it will not fallback to DPS
                client.setRetryPolicy(new MultiHubRetryPolicy());

                // monitor for connects, disconnects, errors, and c2d messages
                client.on('connect', connectHandler);
                client.on('disconnect', disconnectHandler);
                client.on('error', errorHandler);
                if (c2dCommandReceiveOn)
                    client.on('message', messageHandler);

                // connect to IoT Hub
                client.open((err) => {
                    if (err) {
                        console.error(`Could not connect: ${err.message}`);
                        throw new Error(`Hub connect error! Error: ${err.Message}`);
                    } else {
                        // obtain twin object
                        client.getTwin(function(err, twin) {
                            if (err) {
                                throw new Error(`Obtaining twin error! Error: ${err.Message}`);
                            } else {
                                deviceTwin = twin
                                if (desiredPropertyReceiveOn) {
                                    deviceTwin.on('properties.desired', desiredPropertyHandler);
                                }
                                myResolve();
                            }
                        });
                    }
                });
            }
        });
    });
}

// handlef for connection event
function connectHandler() {
    console.log('Connected to IoT Central');  
    connected = true;
}

// handler for disconnects, reconnect via DPS
async function disconnectHandler() {
    if (connected) {
        connected = false;
        console.log('Disconnected from IoT Central');         
        client.close()
        await connect();
    }
}

// handler for errors
function errorHandler(err) {
    console.log(`Error caught in error handler: ${err}`);
}

// sends telemetry on a set frequency
async function sendTelemetry() {
    if (connected) {
        const telemetry = {"temp": (20 + (Math.random() * 100)).toFixed(2), "humidity": (Math.random() * 100).toFixed(2)}
        const message = new Message(JSON.stringify(telemetry));
        client.sendEvent(message, (err, res) => {
            if (err) {
                console.log(`Error: ${err.toString()}`);
            } else {
                console.log(`Completed telemetry send ${JSON.stringify(telemetry)}`);
            }
        });
    }
}

// sends reported properties on a set frequency
async function sendReportedProperty() {
    if (connected) {
        const reportedPropertyPatch = {"battery": (Math.random() * 100).toFixed(2)};
        deviceTwin.properties.reported.update(reportedPropertyPatch, (err) => {
            if (err) {
                console.log(`Error: ${err.toString()}`);
            } else {
                console.log(`Completed reported property send ${JSON.stringify(reportedPropertyPatch)}`);
            }
        });
    }
}

// handles desired properties from IoT Central (or hub)
function desiredPropertyHandler(patch) {
    if (Object.keys(patch).length > 1) {
        console.log(`Desired property received, the data in the desired properties patch is: ${JSON.stringify(patch)}`);

        // acknowledge the desired property back to IoT Central
        let key = Object.keys(patch)[0];
        if (key == "$version") {
            key = Object.keys(patch)[1];
        }
        let reported_payload = {};
        reported_payload[key] = {"value": patch[key], "ac":200, "ad":"completed", "av":patch['$version']};
        deviceTwin.properties.reported.update(reported_payload, (err) => {
            if (err) {
                console.log(`Error sending reported property ${err}`);
            } else {
                console.log(`Completed desired property acknowledgment ${JSON.stringify(reported_payload)}`);
            }
        });
    }
}

// handles direct method 'echo' from IoT Central (or hub)
function echoCommandHandler(request, response) {
    console.log(`Executing direct method request: ${request.methodName}(${request.payload})`);
    // echos back the request payload
    response.send(200, request.payload, function(err) {
        if (err) {
            console.log('Error');
        }
    });
}

// handles the Cloud to Device (C2D) message setAlarm
function setAlarmCommandHandler(request, response) {
    console.log(`Executing C2D message request: ${request.methodName}(${request.payload})`)
    response.send(200, function(err) {
        if (err) {
            console.log('Error');
        }
    });
}


// Connect the device and start processing telemetry, properties and commands
(async () => {
    try {
        console.log('Press Ctrl-C to exit from this when running in the console');

        // connect to IoT Central/Hub via Device Provisioning Service (DPS)
        await connect();

        // handlers for the direct method
        if (directMethodReceiveOn) {
            client.onDeviceMethod('echo', echoCommandHandler);
        }

        // start the interval timers to send telemetry and reported properties
        let sendTelemetryLoop = null;
        let sendReportedPropertiesLoop = null;
        if (telemetrySendOn) {
            const sendTelemetryLoop = setInterval(sendTelemetry, 5000); // send telemetry every 5 seconds
        }
        if (reportedPropertySendOn) {
            const sendReportedPropertiesLoop = setInterval(sendReportedProperty, 15000);  // send reported property every 15 seconds
        }

        // exit handler for cleanup of resources
        function exitHandler(options, exitCode) {
            if (options.cleanup) {
                console.log('Cleaning up and exiting');
                if (sendTelemetryLoop !== null) {
                    clearInterval(sendTelemetryLoop);
                }
                if (sendReportedPropertiesLoop !== null) {
                    clearInterval(sendReportedPropertiesLoop);
                }
                client.close();
            }
            if (options.exit) process.exit();
        }

        // try and cleanly exit when ctrl-c is pressed
        process.on('exit', exitHandler.bind(null,{cleanup:true}));
        process.on('SIGINT', exitHandler.bind(null, {exit:true}));
        process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
        process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

    } catch(e) {
        console.log(`Error: ${e}`);
    }
})();
