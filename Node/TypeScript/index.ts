import './env';
import { FailoverDevice } from './failover';

const defaultProvisioningHost = 'global.azure-devices-provisioning.net';
const defaultDeviceId = 'failover_js';
const defaultDeviceModel = 'dtmi:Sample:Failover;1';

export interface AppContext {
    // device settings - SET VALUES IN .env file
    scopeId: string; // Put your scope id here from IoT Central Administration -> Device connection
    groupSymmetricKey: string; // Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices
    connectionString: string;

    // optional device settings - CHANGE IF DESIRED/NECESSARY
    provisioningHost: string;
    deviceId: string;
    modelId: string;

    // test setting flags
    telemetrySendOn: string;
    reportedPropertySendOn: string;
    desiredPropertyReceiveOn: string;
    directMethodReceiveOn: string;
    c2dCommandReceiveOn: string;

    log(messge: string): void;
}

// app settings - SET VALUES IN .env file
const appContext: AppContext = {
    scopeId: process.env.scopeId,
    groupSymmetricKey: process.env.groupSymmetricKey,
    connectionString: process.env.connectionString,
    provisioningHost: process.env.provisioningHost || defaultProvisioningHost,
    deviceId: process.env.deviceId || defaultDeviceId,
    modelId: process.env.modelId || defaultDeviceModel,
    telemetrySendOn: process.env.telemetrySendOn || '1',
    reportedPropertySendOn: process.env.reportedPropertySendOn || '1',
    desiredPropertyReceiveOn: process.env.desiredPropertyReceiveOn || '1',
    directMethodReceiveOn: process.env.directMethodReceiveOn || '1',
    c2dCommandReceiveOn: process.env.c2dCommandReceiveOn || '1',
    log: (message: string) => {
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] ${message}`);
    }
};

async function start() {
    try {
        appContext.log('Press Ctrl-C to exit from this when running in the console');

        // connect to IoT Central/Hub via Device Provisioning Service (DPS)
        const failoverDevice = new FailoverDevice(appContext);

        await failoverDevice.connect();

        // start the interval timers to send telemetry and reported properties
        let sendTelemetryLoop;
        let sendReportedPropertiesLoop;

        if (appContext.telemetrySendOn === '1') {
            // send telemetry every 5 seconds
            sendTelemetryLoop = setInterval(failoverDevice.sendTelemetry, 5000);
        }

        if (appContext.reportedPropertySendOn === '1') {
            // send reported property every 15 seconds
            sendReportedPropertiesLoop = setInterval(failoverDevice.sendReportedProperty, 15000);
        }

        const exitHandler = async (options, exitCode) => {
            appContext.log('Exit handler called');
            if (options.cleanup) {
                appContext.log(`\nCleaning up and exiting - code: ${exitCode}`);

                if (sendTelemetryLoop) {
                    clearInterval(sendTelemetryLoop);
                }
                if (sendReportedPropertiesLoop) {
                    clearInterval(sendReportedPropertiesLoop);
                }

                await failoverDevice.close();
            }

            if (options.exit) {
                process.exit();
            }
        };

        // try and cleanly exit when ctrl-c is pressed
        process.on('exit', exitHandler.bind(null, { cleanup: true }));
        process.on('SIGINT', exitHandler.bind(null, { exit: true }));
        process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
        process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
    }
    catch (error) {
        appContext.log(`Error starting process: ${error.message}`);
    }
}

void (async () => {
    await start();
})().catch();
