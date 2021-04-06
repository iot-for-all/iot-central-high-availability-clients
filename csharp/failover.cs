using System;
using System.Text;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Collections.Generic;

// imports for Azure IoT
using Microsoft.Azure.Devices.Client;
using Microsoft.Azure.Devices.Provisioning.Client;
using Microsoft.Azure.Devices.Provisioning.Client.Transport;
using Microsoft.Azure.Devices.Shared;

namespace failover
{
    class Program
    {

        // device settings - FILL IN YOUR VALUES HERE
        private static string scopeId = "<Put your scope id here from IoT Central Administration -> Device connection>";
        private static string groupSymmetricKey = "<Put your group SAS primary key here from IoT Central Administration -> Device Connection -> SAS-IoT-Devices>";

        // optional device settings - CHANGE IF DESIRED/NECESSARY
        private static string deviceId = "failover3_cs";
        private static string globalDeviceEndpoint = "global.azure-devices-provisioning.net";
        private static string modelId = "dtmi:Sample:Failover;1";
 
        // test setting flags
        private static bool telemetrySendOn = true;
        private static bool reportedPropertySendOn = true;
        private static bool desiredPropertyReceiveOn = true;
        private static bool directMethodReceiveOn = true;
        private static bool c2dCommandReceiveOn = true;

        // general purpose variables
        private static DeviceClient iotClient;
        private static bool connected = false;
        private static bool terminate = false;


        // calculate the device key using the symetric group key
        private static string ComputeDerivedSymmetricKey(string enrollmentKey, string deviceId)
        {
            if (string.IsNullOrWhiteSpace(enrollmentKey))
            {
                return enrollmentKey;
            }

            using var hmac = new HMACSHA256(Convert.FromBase64String(enrollmentKey));
            return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(deviceId)));
        }


        // monitor for the ESC key to be pressed for exiting the program
        public static void MonitorKeypress()
        {
            ConsoleKeyInfo cki = new ConsoleKeyInfo();
            do 
            {
                cki = Console.ReadKey(true);
            } while (cki.Key != ConsoleKey.Escape);   
            terminate = true;   
        }

        
        // handler for disconnects, reconnect via DPS
        public static async void ConnectionStatusChanges(ConnectionStatus status, ConnectionStatusChangeReason reason) {
            Console.WriteLine($"Connection Status: {status}");
            if (status == ConnectionStatus.Connected) {
                connected = true;
            } else if (status == ConnectionStatus.Disconnected) {
                // we are disconnected, need to reconnect via DPS
                connected = false;
                if (iotClient != null) {
                    await iotClient.CloseAsync();
                }
                await Connect();
            }
        }


        // handles desired properties from IoT Central (or hub)
        private static async Task OnDesiredPropertyChangedAsync(TwinCollection desiredProperties, object userContext)
        {
            if (desiredProperties.Contains("fanSpeed")) {
                Console.WriteLine($"Fan speed change value from IoT Central: {desiredProperties["fanSpeed"]}");

                // acknowledge the desired property back to IoT Central
                var reportedProperties = new TwinCollection($"{{\"fanSpeed\":{{\"value\": {desiredProperties["fanSpeed"]}, \"ac\":200, \"ad\":\"completed\", \"av\":{desiredProperties["$version"]}}}}}");
                await iotClient.UpdateReportedPropertiesAsync(reportedProperties);                
            } else {
                Console.WriteLine($"Unknown desired property: {desiredProperties.ToJson()}");
            }
        }


        // handles direct method 'echo' from IoT Central (or hub)
        private static async Task<MethodResponse> OnEchoMessageReceivedAsync(MethodRequest methodRequest, object userContext) {
            Console.WriteLine($"Echo command received with parameter {Encoding.UTF8.GetString(methodRequest.Data)}");
            
            // acknowledge the direct method
            return new MethodResponse(methodRequest.Data, 200); 
        }

        // handles the Cloud to Device (C2D) message setAlarm
        private static async Task OnC2dMessageReceivedAsync(Message receivedMessage, object userContext) {
            Console.WriteLine($"Received C2D message {receivedMessage.Properties["method-name"]}");
            if (receivedMessage.Properties["method-name"] == "setAlarm") {
                Console.WriteLine($"Setting an alarm for {Encoding.ASCII.GetString(receivedMessage.GetBytes())}");
            }
            receivedMessage.Dispose();
        }


        // connect to IoT Central/Hub via Device Provisioning Servicee (DPS)
        public static async Task Connect() {
            // calc device symmetric key from group symmetric key
            string deviceKey = ComputeDerivedSymmetricKey(groupSymmetricKey, deviceId);

            Console.WriteLine($"Initializing the device provisioning client...");
            // DPS provision with device symmetric key
            using var security = new SecurityProviderSymmetricKey(
                deviceId,
                deviceKey,
                null);

            using var transportHandler = new ProvisioningTransportHandlerMqtt(TransportFallbackType.WebSocketOnly);


            ProvisioningDeviceClient provClient = ProvisioningDeviceClient.Create(
                globalDeviceEndpoint,
                scopeId,
                security,
                transportHandler);
            
            Console.WriteLine($"Initialized for registration Id {security.GetRegistrationID()}.");

            // set the model to register against
            var modelPayload = new ProvisioningRegistrationAdditionalData
            {
                JsonData = $"{{ \"modelId\": \"{modelId}\" }}",
            };

            Console.WriteLine("Registering with the device provisioning service...");
            // register the device and get the hub host name
            DeviceRegistrationResult result = await provClient.RegisterAsync(modelPayload);

            Console.WriteLine($"Registration status: {result.Status}.");
            if (result.Status != ProvisioningRegistrationStatusType.Assigned)
            {
                Console.WriteLine($"Registration status did not assign a hub, so exiting this sample.");
                return;
            }

            Console.WriteLine($"Device {result.DeviceId} registered to {result.AssignedHub}.");

            Console.WriteLine("Creating symmetric key authentication for IoT Hub...");
            IAuthenticationMethod auth = new DeviceAuthenticationWithRegistrySymmetricKey(
                result.DeviceId,
                security.GetPrimaryKey());

            Console.WriteLine($"Testing the provisioned device with IoT Hub...");
            iotClient = DeviceClient.Create(result.AssignedHub, auth, TransportType.Mqtt);
            iotClient.SetConnectionStatusChangesHandler(ConnectionStatusChanges);

            // cannot use the default retry logic built into the SDK as it will not fallback to DPS
            iotClient.SetRetryPolicy(new NoRetry());
            
            // handler for desired twin properties
            if (desiredPropertyReceiveOn) {
                await iotClient.SetDesiredPropertyUpdateCallbackAsync(OnDesiredPropertyChangedAsync, null);
            }

            // handlers for the direct method
            if (directMethodReceiveOn) {
                await iotClient.SetMethodHandlerAsync("echo", OnEchoMessageReceivedAsync, null);
            }

            // handler for C2D messages
            if (c2dCommandReceiveOn) {
                await iotClient.SetReceiveMessageHandlerAsync(OnC2dMessageReceivedAsync, null);
            }
        }


        // sends telemetry on a set frequency
        public static async Task SendTelemetry(int sendFrequencyInSeconds) {
            var rand = new Random();
            while (!terminate) {
                if (connected) {
                    var telemetryPayload = $"{{\"temp\": {Math.Round(rand.NextDouble() * 100, 2)}, \"humidity\": {Math.Round(rand.NextDouble() * 100, 2)}}}";
                    Console.WriteLine($"Sending telemetry: {telemetryPayload}");
                    using var message = new Message(Encoding.UTF8.GetBytes(telemetryPayload));
                    message.ContentType = "application/json";
                    message.ContentEncoding = Encoding.UTF8.ToString();
                    await iotClient.SendEventAsync(message);
                }
                System.Threading.Thread.Sleep(sendFrequencyInSeconds * 1000);
            }
        }


        // sends reported properties on a set frequency
        public static async Task SendReportedProperty(int sendFrequencyInSeconds) {
            var rand = new Random();
            while (!terminate) {
                if (connected) {
                    var reportedProperties = new TwinCollection
                    {
                        ["battery"] = Math.Round(rand.NextDouble() * 100, 2)
                    };
                    Console.WriteLine($"Sending twin reported property: {reportedProperties.ToJson()}");

                    await iotClient.UpdateReportedPropertiesAsync(reportedProperties);
                }
                System.Threading.Thread.Sleep(sendFrequencyInSeconds * 1000);                
            }
        }


        // Entry point: Connect the device and start processing telemetry, properties and commands
        public static async Task<int> Main(string[] args)
        {
            // connect to IoT Hub via DPS
            await Connect();

            // keyboard monitor
            Console.WriteLine("\n\n*** Press the ESC key to exit from this program and shutdown things cleanly ***\n\n");
            Task consoleKeyTask = Task.Run(() => { MonitorKeypress(); });

            // start the telemetry and reported property send tasks
            List<Task> tasks = new List<Task>();
            if (telemetrySendOn) {
                tasks.Add(SendTelemetry(5));
            }
            if (reportedPropertySendOn) {
                tasks.Add(SendReportedProperty(10));
            }

            // await the termination of the telemetry and reported property send tasks
            await Task.WhenAll(tasks);

            // clean up
            Console.WriteLine("Cleaning up and exiting");
            await iotClient.CloseAsync();

            return 1;
        }
    }
}
