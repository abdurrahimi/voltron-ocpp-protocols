const url = "wss://33ec6008c0d5.ngrok-free.app/v1/ocpp/G1M8tVMvRwHePFtW0AT";

// Buat koneksi WebSocket dengan subprotocol "ocpp1.6"
const ws = new WebSocket(url, ["ocpp1.6"]);

ws.onopen = () => {
  console.log("✅ Connected to OCPP 1.6J via ngrok");
  // kirim boot notification sebagai contoh
  const bootNotification = [
    2, // CALL message
    "123456", // Unique ID
    "BootNotification", // Action
    {
      chargePointVendor: "DemoVendor",
      chargePointModel: "DemoModel",
      firmwareVersion: "1.0.0",
    }
  ];
  ws.send(JSON.stringify(bootNotification));
  console.log("📤 Sent BootNotification:", bootNotification);
};

ws.onmessage = (msg) => {
  console.log("📩 Message received:", msg.data);
};

ws.onerror = (err) => {
  console.error("❌ Error:", err);
};

ws.onclose = () => {
  console.log("🔌 Connection closed");
};