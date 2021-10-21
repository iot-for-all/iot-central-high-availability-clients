// Azure IoT Device SDK
import { Mqtt as Protocol } from 'azure-iot-device-mqtt';
import {
    DeviceMethodRequest,
    DeviceMethodResponse,
    Client,
    Twin,
    Message
} from 'azure-iot-device';
import { ExponentialBackOffWithJitter } from 'azure-iot-common';

// Azure IoT DPS SDK
import { Mqtt as ProvisioningTransport } from 'azure-iot-provisioning-device-mqtt';
import { SymmetricKeySecurityClient } from 'azure-iot-security-symmetric-key';
import { ProvisioningDeviceClient } from 'azure-iot-provisioning-device';

// Crypto SDK needed for computing device keys
import * as crypto from 'crypto';

import { bind } from 'bind-decorator';
import { AppContext } from './index';

enum FailoverDeviceCapability {
    tlTemp = 'temp',
    tlHumidity = 'humidity',
    rpBattery = 'battery',
    cmEcho = 'echo',
    cmSetAlarm = 'setAlarm',
    wpFanSpeed = 'fanSpeed'
}

interface IDeviceSettings {
    [FailoverDeviceCapability.wpFanSpeed]: number;
}

// Azure IoT Central custom retry policy derived from ExponentialBackOffWithJitter
class MultiHubRetryPolicy extends ExponentialBackOffWithJitter {
    constructor(...args) {
        super(...args);
    }

    public shouldRetry(err): boolean {
        if (err.message === 'Connection refused: Server unavailable') {
            return false; // if hub not available stop retry and fall back to DPS
        }

        return super.shouldRetry(err);
    }

    public nextRetryTimeout(retryCount, throttled): number {
        return super.nextRetryTimeout(retryCount, throttled);
    }
}

export class FailoverDevice {
    private app: AppContext;
    private deviceClient: Client;
    private deviceTwin: Twin;
    private deviceSettings: IDeviceSettings;
    private deviceConnected: boolean;

    constructor(appContext: AppContext) {
        this.app = appContext;

        this.deviceSettings = {
            [FailoverDeviceCapability.wpFanSpeed]: 0
        };
        this.deviceConnected = false;
    }

    // connect to IoT Central/Hub via Device Provisioning Servicee (DPS)
    public async connect(): Promise<void> {
        try {
            let connectionString = this.app.connectionString;
            if (!connectionString) {
                // calc device symmetric key from group symmetric key
                const deviceSymmetricKey = this.computeDerivedSymmetricKey(this.app.groupSymmetricKey, this.app.deviceId);

                // DPS provision with device symmetric key
                const provisioningSecurityClient = new SymmetricKeySecurityClient(this.app.deviceId, deviceSymmetricKey);
                const provisioningClient = ProvisioningDeviceClient.create(this.app.provisioningHost, this.app.scopeId, new ProvisioningTransport(), provisioningSecurityClient);

                // set the model to register against
                provisioningClient.setProvisioningPayload({
                    iotcModelId: this.app.modelId
                });

                // register the device and get the hub host name
                connectionString = await new Promise<string>((resolve, reject) => {
                    provisioningClient.register((dpsError, dpsResult) => {
                        if (dpsError) {
                            this.app.log(`DPS register failed: ${JSON.stringify(dpsError, null, 4)}`);

                            return reject(dpsError);
                        }

                        this.app.log('registration succeeded');
                        this.app.log(`assigned hub: ${dpsResult.assignedHub}`);
                        this.app.log(`deviceId: ${dpsResult.deviceId}`);

                        return resolve(`HostName=${dpsResult.assignedHub};DeviceId=${dpsResult.deviceId};SharedAccessKey=${deviceSymmetricKey}`);
                    });
                });
            }

            // create client from connection string
            this.app.log(`Connection string: ${connectionString}`);
            this.deviceClient = Client.fromConnectionString(connectionString, Protocol);

            // cannot use the default retry logic built into the SDK as it will not fallback to DPS
            this.deviceClient.setRetryPolicy(new MultiHubRetryPolicy());

            // monitor for connects, disconnects, errors, and c2d messages
            this.deviceClient.on('connect', this.connectHandler);
            this.deviceClient.on('disconnect', this.disconnectHandler);
            this.deviceClient.on('error', this.errorHandler);

            if (this.app.c2dCommandReceiveOn === '1') {
                this.deviceClient.on('message', this.messageHandler);
            }

            // connect to IoT Hub
            await this.deviceClient.open();

            // obtain twin object
            this.deviceTwin = await this.deviceClient.getTwin();

            if (this.app.desiredPropertyReceiveOn === '1') {
                this.deviceTwin.on('properties.desired', this.desiredPropertyHandler);
            }

            // handlers for the direct method
            if (this.app.directMethodReceiveOn === '1') {
                this.deviceClient.onDeviceMethod(FailoverDeviceCapability.cmEcho, this.echoCommandDirectMethodHandler);
            }
        }
        catch (err) {
            this.app.log(`Could not connect: ${err.message}`);
            throw new Error(`Hub connect error! Error: ${err.message}`);
        }
    }

    public async close(): Promise<void> {
        if (this.deviceClient) {
            this.deviceTwin.removeAllListeners();
        }

        if (this.deviceClient) {
            this.deviceClient.removeAllListeners();
            await this.deviceClient.close();
        }

        this.deviceClient = null;
        this.deviceTwin = null;
    }

    // sends telemetry on a set frequency
    @bind
    public async sendTelemetry(): Promise<void> {
        if (!this.deviceConnected) {
            return;
        }

        const telemetry = {
            temp: (20 + (Math.random() * 100)).toFixed(2),
            humidity: (Math.random() * 100).toFixed(2)
        };

        try {
            const message = new Message(JSON.stringify(telemetry));

            await this.deviceClient.sendEvent(message);

            this.app.log(`Completed telemetry send ${JSON.stringify(telemetry)}`);
        }
        catch (err) {
            this.app.log(`Error: ${err.toString()}`);
        }
    }

    // sends reported properties on a set frequency
    @bind
    public async sendReportedProperty(): Promise<void> {
        if (!this.deviceConnected) {
            return;
        }

        const reportedPropertyPatch = {
            battery: (Math.random() * 100).toFixed(2)
        };

        await this.updateDeviceProperties(reportedPropertyPatch);
    }

    // calculate the device key using the symetric group key
    private computeDerivedSymmetricKey(masterKey, deviceId): string {
        return crypto.createHmac('SHA256', Buffer.from(masterKey, 'base64'))
            .update(deviceId, 'utf8')
            .digest('base64');
    }

    @bind
    private async desiredPropertyHandler(desiredProperties: any) {
        try {
            this.app.log(`Desired property received, the data in the desired properties patch is: ${JSON.stringify(desiredProperties)}`);

            const patchedProperties = {};

            for (const setting in desiredProperties) {
                if (!Object.prototype.hasOwnProperty.call(desiredProperties, setting)) {
                    continue;
                }

                if (setting === '$version') {
                    continue;
                }

                const value = desiredProperties[setting];

                switch (setting) {
                    // IDeviceSettings
                    case FailoverDeviceCapability.wpFanSpeed:
                        patchedProperties[setting] = {
                            value: (this.deviceSettings[setting] as any) = value || 0,
                            ac: 200,
                            ad: 'completed',
                            av: desiredProperties['$version']
                        };
                        break;

                    default:
                        this.app.log(`Received desired property change for unknown setting '${setting}'`);
                        break;
                }
            }

            if (Object.keys(patchedProperties || {}).length) {
                await this.updateDeviceProperties(patchedProperties);
            }
        }
        catch (err) {
            this.app.log(`Exception while handling desired properties: ${err.message}`);
        }
    }

    private async updateDeviceProperties(properties): Promise<void> {
        if (!this.deviceTwin) {
            return;
        }

        try {
            await new Promise((resolve, reject) => {
                this.deviceTwin.properties.reported.update(properties, (err) => {
                    if (err) {
                        this.app.log(`Error: ${err.toString()}`);
                        return reject(err);
                    }

                    this.app.log(`Completed property send ${JSON.stringify(properties)}`);
                    return resolve('');
                });
            });
        }
        catch (err) {
            this.app.log(`Error: ${err.message}`);
        }
    }

    // handler for C2D message
    @bind
    private async messageHandler(msg: Message): Promise<void> {
        const methodName = msg.properties.propertyList.find(o => o.key === 'method-name');

        if (methodName) {
            switch (methodName.value) {
                case FailoverDeviceCapability.cmSetAlarm:
                    this.app.log(`C2D method: ${methodName.value}(${msg.data.toString('utf-8')})`);

                    await this.setAlarmCommandHandler(msg);
                    break;

                default:
                    this.app.log(`Unknown C2D method received: ${methodName.value}`);
            }
        }
    }

    // handles the Cloud to Device (C2D) message setAlarm
    private async setAlarmCommandHandler(msg: Message): Promise<void> {
        try {
            // delete the message from the device queue
            await this.deviceClient.complete(msg);
        }
        catch (err) {
            this.app.log(`Error handling C2D method: ${err.message}`);
        }
    }

    // handles direct method 'echo' from IoT Central (or hub)
    @bind
    private async echoCommandDirectMethodHandler(request: DeviceMethodRequest, response: DeviceMethodResponse): Promise<void> {
        this.app.log(`Executing direct method request: ${request.methodName} "${request.payload}"`);

        try {
            // echos back the request payload
            await response.send(200, request.payload);
        }
        catch (err) {
            this.app.log(`Error in command response: ${err.message}`);
        }
    }

    // handlef for connection event
    @bind
    private connectHandler(): void {
        this.app.log('Connected to IoT Central');
        this.deviceConnected = true;
    }

    // handler for disconnects, reconnect via DPS
    @bind
    private async disconnectHandler(): Promise<void> {
        if (!this.deviceConnected) {
            return;
        }

        this.deviceConnected = false;
        this.app.log('Disconnected from IoT Central');

        this.app.log('Closing device client connection');
        await this.deviceClient.close();

        this.app.log('Waiting for 90sec...');
        await new Promise((resolve) => {
            setTimeout(() => {
                return resolve('');
            }, 1000 * 90);
        });

        this.app.log('Starting device registration');
        await this.connect();
    }

    // handler for errors
    @bind
    private errorHandler(err): void {
        this.app.log(`Error caught in error handler: ${err}`);
    }
}
