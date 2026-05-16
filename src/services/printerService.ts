import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, NativeModules, PermissionsAndroid, Platform } from "react-native";
import { Order, OrderItem } from "../db/ordersDB";
import { Settings } from "../db/settingsDB";

// Safe Import Pattern to prevent crashes in Expo Go
let BLEPrinter: any = null;

const initializeBLE = () => {
  if (BLEPrinter) return BLEPrinter;
  
  try {
    // Check if we are in a native environment with the printer module
    if (Platform.OS === 'android' && NativeModules.RNBLEPrinter) {
      const printerLib = require("react-native-thermal-receipt-printer");
      BLEPrinter = printerLib.BLEPrinter;
      console.log("PrinterService: Native BLEPrinter module loaded successfully");
    } else {
      console.warn("PrinterService: Native module not found. Using Mocks.");
      BLEPrinter = createMockPrinter();
    }
  } catch (e) {
    console.warn("PrinterService: Failed to load native printer module. Using Mocks.", e);
    BLEPrinter = createMockPrinter();
  }
  return BLEPrinter;
};

const createMockPrinter = () => ({
  init: async () => { console.log("MOCK: BLEPrinter.init()"); return Promise.resolve(); },
  getDeviceList: async () => { console.log("MOCK: BLEPrinter.getDeviceList()"); return []; },
  connectPrinter: async () => { console.log("MOCK: BLEPrinter.connectPrinter()"); return Promise.resolve(true); },
  printBill: async () => { console.log("MOCK: BLEPrinter.printBill()"); return Promise.resolve(); },
});

// Initialize with a mock by default if we can't find the real one immediately
BLEPrinter = createMockPrinter();
// Try to load real one
initializeBLE();

class PrinterService {
  connected: boolean = false;
  currentPrinter: any = null;
  isInitialized: boolean = false;
  isMock: boolean = false;
  paperWidth: number = 58; // Default 58mm
  charsPerLine: number = 32; // Default for 58mm

  constructor() {
    this.isMock = !NativeModules.RNBLEPrinter;
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const width = await AsyncStorage.getItem('printer_paper_width');
      if (width) {
        this.setPaperWidth(parseInt(width, 10));
      }
      const savedPrinter = await AsyncStorage.getItem('last_printer');
      if (savedPrinter) {
        this.currentPrinter = JSON.parse(savedPrinter);
      }
    } catch (e) {
      console.warn("Failed to load printer settings", e);
    }
  }

  setPaperWidth(mm: number) {
    this.paperWidth = mm;
    this.charsPerLine = mm >= 80 ? 48 : 32;
    AsyncStorage.setItem('printer_paper_width', mm.toString());
  }

  async requestPermissions() {
    if (Platform.OS !== 'android') return true;
    
    console.log("PrinterService: Requesting permissions with safety timeout...");
    
    const requestWithTimeout = async () => {
      try {
        if (Platform.Version >= 31) {
          console.log("PrinterService: Checking Bluetooth Connect...");
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          console.log("PrinterService: Checking Bluetooth Scan...");
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          console.log("PrinterService: Checking Fine Location...");
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        } else {
          console.log("PrinterService: Requesting Legacy Location...");
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        }
        return true;
      } catch (e) {
        console.error("PrinterService: Permission request error", e);
        return false;
      }
    };

    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        console.warn("PrinterService: Permission request timed out after 5s");
        resolve(false); 
      }, 5000);
    });

    // We race the request against a 5s timeout so the app doesn't stay stuck
    return Promise.race([requestWithTimeout(), timeout]);
  }

  async init() {
    console.log("PrinterService: Initializing...");
    if (this.isInitialized) return true;
    
    // We try to request permissions, but we don't block forever if it hangs
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn("PrinterService: Permission check was not successful or timed out. Proceeding anyway...");
    }
    
    try {
      console.log("PrinterService: Calling BLEPrinter.init()...");
      const result = await BLEPrinter.init();
      console.log("PrinterService: BLEPrinter.init() returned:", result);
      this.isInitialized = true;
      console.log("PrinterService: Initialization successful");
      return true;
    } catch (e) {
      console.error("PrinterService: Initialization failed", e);
      // If it's a real device and it fails here, show the instructions
      if (NativeModules.RNBLEPrinter) {
        Alert.alert(
          "Setup Required", 
          "Bluetooth initialization failed. Please ensure Bluetooth is ON and permissions are granted in App Settings.",
          [{ text: "OK" }]
        );
      }
      return false;
    }
  }

  async getDevices() {
    console.log("PrinterService: Getting device list...");
    const initialized = await this.init();
    if (!initialized) {
      console.error("PrinterService: Cannot get devices, init failed");
      return [];
    }
    
    try {
      console.log("PrinterService: Calling BLEPrinter.getDeviceList()...");
      // Set a timeout for device discovery
      const devicePromise = BLEPrinter.getDeviceList();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Discovery Timeout")), 10000)
      );
      
      const devices = await Promise.race([devicePromise, timeoutPromise]) as any[];
      
      console.log("PrinterService: Found devices:", devices?.length || 0);
      if (devices && devices.length > 0) {
        devices.forEach((d: any, i: number) => {
          console.log(`[${i}] ${d.device_name} (${d.inner_mac_address})`);
        });
      } else {
        console.warn("PrinterService: Device list is empty");
      }
      return devices || [];
    } catch (e) {
      console.error("PrinterService: Failed to get device list", e);
      return [];
    }
  }

  async connect(device: any) {
    try {
      await BLEPrinter.connectPrinter(device.inner_mac_address);
      this.connected = true;
      this.currentPrinter = device;
      AsyncStorage.setItem('last_printer', JSON.stringify(device));
      return true;
    } catch (e) {
      Alert.alert("Connection Failed", "Could not connect to the printer.");
      return false;
    }
  }

  async printOrder(order: Order, items: OrderItem[], settings: Settings) {
    if (!this.connected) {
      if (this.currentPrinter) {
        const reconnected = await this.connect(this.currentPrinter);
        if (!reconnected) return false;
      } else {
        Alert.alert("Not Connected", "Please connect to a Bluetooth printer in settings.");
        return false;
      }
    }

    const width = this.charsPerLine;
    const center = (text: string) => {
      const pad = Math.floor((width - text.length) / 2);
      return " ".repeat(Math.max(0, pad)) + text + "\n";
    };
    const leftRight = (left: string, right: string) => {
      const space = width - left.length - right.length;
      return left + " ".repeat(Math.max(1, space)) + right + "\n";
    };

    let receipt = "";
    receipt += "\x1B\x45\x01"; // Bold On
    receipt += center(settings.restaurant_name || "RESTAURANT");
    receipt += "\x1B\x45\x00"; // Bold Off
    
    if (settings.restaurant_address) receipt += center(settings.restaurant_address);
    if (settings.restaurant_phone) receipt += center(`Ph: ${settings.restaurant_phone}`);
    
    receipt += "-".repeat(width) + "\n";
    receipt += `Order: #${order.order_number}\n`;
    const formattedDate = order.created_at ? new Date(order.created_at.replace(' ', 'T')).toLocaleString() : new Date().toLocaleString();
    receipt += `Date: ${formattedDate}\n`;
    if (order.table_no) receipt += `Table: ${order.table_no}\n`;
    receipt += "-".repeat(width) + "\n";

    // Items Header
    receipt += leftRight("Item", "Amt");
    receipt += "-".repeat(width) + "\n";

    items.forEach(item => {
      try {
        // Line 1: Item Name
        receipt += `${item.item_name || 'Item'}\n`;
        
        // Line 2: Qty x Rate and Subtotal
        const qty = Number(item.quantity || 0);
        const rate = Number(item.rate || 0);
        const subtotal = Number(item.subtotal || 0);
        
        const qtyLine = `  ${qty} x ${rate.toFixed(2)}`;
        const amt = subtotal.toFixed(2);
        receipt += leftRight(qtyLine, amt);
      } catch (err) {
        console.warn("Error formatting item line", err);
      }
    });

    receipt += "-".repeat(width) + "\n";
    receipt += leftRight("Subtotal", Number(order.subtotal || 0).toFixed(2));
    if (order.discount > 0) receipt += leftRight("Discount", `-${Number(order.discount || 0).toFixed(2)}`);
    receipt += "\x1B\x45\x01"; // Bold On
    receipt += leftRight("TOTAL", Number(order.grand_total || 0).toFixed(2));
    receipt += "\x1B\x45\x00"; // Bold Off
    
    if (order.is_split_payment) {
      receipt += leftRight("- Cash", Number(order.cash_amount || 0).toFixed(2));
      receipt += leftRight("- UPI", Number(order.upi_amount || 0).toFixed(2));
    }

    receipt += "-".repeat(width) + "\n";
    
    receipt += center(settings.receipt_footer || "Thank you!");
    receipt += "\n\n\n"; // Feed

    console.log("PrinterService: Final receipt string length:", receipt.length);

    try {
      if (!BLEPrinter || !BLEPrinter.printBill) {
        throw new Error("BLEPrinter module not ready");
      }
      await BLEPrinter.printBill(receipt);
      return true;
    } catch (e) {
      console.error("Print Error during printBill:", e);
      Alert.alert("Print Error", "Failed to send data to printer. Make sure you are using a Development Build, not Expo Go.");
      return false;
    }
  }
}

export default new PrinterService();
