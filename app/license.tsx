import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Helper function to manage licenses array
const addLicenseToStorage = async (licenseData: any) => {
  try {
    const existingLicensesStr = await AsyncStorage.getItem("activatedLicenses");
    let licenses = existingLicensesStr ? JSON.parse(existingLicensesStr) : [];
    
    // Check if license already exists (by client_id)
    const existingIndex = licenses.findIndex((l: any) => l.client_id === licenseData.client_id);
    
    if (existingIndex >= 0) {
      // Update existing license
      licenses[existingIndex] = { ...licenses[existingIndex], ...licenseData };
    } else {
      // Add new license
      licenses.push(licenseData);
    }
    
    await AsyncStorage.setItem("activatedLicenses", JSON.stringify(licenses));
    console.log("✅ License added/updated in storage:", licenseData.shop_name);
  } catch (error) {
    console.error("Error managing licenses:", error);
  }
};

export default function LicenseActivationScreen({ onActivationSuccess }: { onActivationSuccess?: () => void }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [checking, setChecking] = useState(true);
  const [isAddingLicense, setIsAddingLicense] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [demoShopName, setDemoShopName] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoUsed, setDemoUsed] = useState(false);
  const [demoRemainingDays, setDemoRemainingDays] = useState<number | null>(null);
  const [isUpgradeMode, setIsUpgradeMode] = useState(false);

  useEffect(() => {
    if (params.mode === 'upgrade') {
      setIsUpgradeMode(true);
    }
    initializeApp(params.mode === 'upgrade');
  }, [params.mode]);

  const getDeviceId = async () => {
    try {
      let id: string | null = null;

      if (Platform.OS === "android") {
        // Method 1: Application.androidId (Synchronous)
        id = Application.androidId;
        console.log("Method 1 - Application.androidId:", id);

        if (id && id !== "null" && id !== "" && id !== "unknown") {
          console.log("✅ Using Application.androidId:", id);
          return id;
        }

        // Method 2: Application.getAndroidId() (Asynchronous)
        if (Application.getAndroidId) {
          try {
            id = await Application.getAndroidId();
            console.log("Method 2 - Application.getAndroidId():", id);

            if (id && id !== "null" && id !== "" && id !== "unknown") {
              console.log("✅ Using Application.getAndroidId():", id);
              return id;
            }
          } catch (e) {
            console.log("Method 2 failed:", e);
          }
        }

        // Method 3: Check if we have a previously stored device ID
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("✅ Using stored device ID:", storedId);
          return storedId;
        }

        // If all methods fail, generate a UUID-based persistent ID
        console.log("⚠️ Android ID not available, generating persistent UUID");
        const uuid = 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function (c) {
          const r = Math.random() * 16 | 0;
          return r.toString(16);
        });

        // Store it permanently
        await AsyncStorage.setItem("device_hardware_id", uuid);
        console.log("✅ Generated and stored UUID:", uuid);
        return uuid;

      } else if (Platform.OS === "ios") {
        // Get iOS IDFV
        id = await Application.getIosIdForVendorAsync();

        console.log("iOS IDFV from Application:", id);

        if (id && id !== "null" && id !== "") {
          console.log("✅ Using iOS IDFV:", id);
          return id;
        }

        // Fallback for iOS - check stored ID
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("✅ Using stored iOS device ID:", storedId);
          return storedId;
        }

        // Generate UUID for iOS fallback
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

        await AsyncStorage.setItem("device_hardware_id", uuid);
        console.log("✅ Generated and stored iOS UUID:", uuid);
        return uuid;

      } else {
        throw new Error("Unsupported platform: " + Platform.OS);
      }

    } catch (error: any) {
      console.error("❌ CRITICAL ERROR getting device ID:", error);

      // Last resort - try to get stored ID
      try {
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("Using emergency stored device ID");
          return storedId;
        }
      } catch (e) {
        console.error("Storage error:", e);
      }

      Alert.alert(
        "Device ID Error",
        error.message || "Unable to get device identifier",
        [
          {
            text: "Retry",
            onPress: () => {
              initializeApp();
            }
          },
          {
            text: "Exit",
            style: "cancel"
          }
        ]
      );

      throw error;
    }
  };

  const getDeviceName = async () => {
    try {
      let name = "";

      if (Platform.OS === "android") {
        const brand = Device.brand || "";
        const modelName = Device.modelName || "";
        name = `${brand} ${modelName}`.trim() || "Android Device";
      } else if (Platform.OS === "ios") {
        const modelName = Device.modelName || "";
        name = modelName || "iOS Device";
      } else {
        name = "Unknown Device";
      }

      return name;
    } catch (error) {
      console.error("Error getting device name:", error);
      return "Unknown Device";
    }
  };

  const initializeApp = async () => {
    try {
      setChecking(true);

      // FIRST: Check if we're in adding mode (check if licenses already exist)
      const existingLicenses = await AsyncStorage.getItem('activatedLicenses');
      let hasExistingLicenses = false;
      
      if (existingLicenses) {
        const licenses = JSON.parse(existingLicenses);
        if (licenses.length > 0) {
          hasExistingLicenses = true;
          console.log("✅ Adding mode detected - user has", licenses.length, "existing license(s)");
          setIsAddingLicense(true);
        }
      }

      // Get device ID
      const id = await getDeviceId();
      setDeviceId(id || "");

      // Get device name
      const name = await getDeviceName();
      setDeviceName(name);

      console.log("=== DEVICE INFO ===");
      console.log("Platform:", Platform.OS);
      console.log("Device ID:", id);
      console.log("Device Name:", name);
      console.log("Is Physical Device:", Device.isDevice);
      console.log("Has Existing Licenses:", hasExistingLicenses);
      console.log("===================");

      // If adding license, skip registration check and show form immediately
      if (hasExistingLicenses) {
        console.log("✅ Showing license form for adding new license");
        setChecking(false);
        return;
      }

      // Check if demo was already used
      const used = await AsyncStorage.getItem("demoUsed");
      const expiryStr = await AsyncStorage.getItem("demo_expiry") || await AsyncStorage.getItem("demoExpiresAt");
      console.log("📱 Demo Used status:", used, "Expiry:", expiryStr);
      
      if (used === "true") {
        setDemoUsed(true);
        if (expiryStr) {
          const expiry = new Date(expiryStr);
          const now = new Date();
          const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) setDemoRemainingDays(diff);
        }
      }

      // First time - check if device is already registered in the API
      const isRegistered = await checkDeviceRegistration(id);
      console.log("📱 Device Registered:", isRegistered);
      console.log("📱 isAddingLicense:", hasExistingLicenses);

      if (isRegistered) {
        console.log("✅ Device already registered, skipping license screen");
        if (onActivationSuccess) {
          onActivationSuccess();
        } else {
          router.replace('/(tabs)');
        }
      } else {
        console.log("❌ Device not registered, showing license screen");
        setChecking(false);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      setChecking(false);
    }
  };

  const checkDeviceRegistration = async (deviceIdToCheck: string | null) => {
    try {
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/melonelite/`;

      console.log("Checking device registration for:", deviceIdToCheck);

      const response = await fetch(CHECK_LICENSE_API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (!response.ok || !data.success) {
        console.log("API check failed");
        return false;
      }

      if ((!data.customers || data.customers.length === 0) && (!data.demo_licenses || data.demo_licenses.length === 0)) {
        console.log("No customers or demo licenses found");
        return false;
      }

      // Check if this device is registered under any customer
      if (data.customers) {
        for (const customer of data.customers) {
          if (customer.registered_devices && customer.registered_devices.length > 0) {
            const deviceFound = customer.registered_devices.some(
              (device: any) => device.device_id === deviceIdToCheck
            );

            if (deviceFound) {
              console.log("✅ Device found in customer:", customer.customer_name);

              // Store in new clean real license keys
              await AsyncStorage.setItem("licenseActivated", "true");
              await AsyncStorage.setItem("licenseKey", customer.license_key);
              await AsyncStorage.setItem("license_type", "real");
              await AsyncStorage.setItem("real_license_key", customer.license_key);
              await AsyncStorage.setItem("real_customer_name", customer.customer_name);
              await AsyncStorage.setItem("real_client_id", customer.client_id);
              await AsyncStorage.setItem("real_status", customer.status || "Active");
              if (customer.license_validity) {
                await AsyncStorage.setItem("real_expiry", customer.license_validity.expiry_date || "");
                await AsyncStorage.setItem("real_is_expired", customer.license_validity.is_expired ? "true" : "false");
              }
              if (deviceIdToCheck) await AsyncStorage.setItem("deviceId", deviceIdToCheck);

              console.log("✅ Stored client_id:", customer.client_id);
              return true;
            }
          }
        }
      }

      // Check if device is registered in demo licenses
      const storedIsDemo = await AsyncStorage.getItem("isDemo");
      if (storedIsDemo === "true") {
        if (data.demo_licenses) {
          const storedKey = await AsyncStorage.getItem("licenseKey");
          const demoMatch = data.demo_licenses.find((d: any) => d.demo_license === storedKey);
          if (demoMatch) {
            console.log("✅ Device found in demo licenses");
            return true;
          }
        }
      }

      console.log("❌ Device not found in any customer");
      return false;
    } catch (error) {
      console.error("Error checking device registration:", error);
      return false;
    }
  };

  const handleActivate = async () => {
    // Validate license key
    if (!licenseKey.trim()) {
      Alert.alert("Error", "Please enter a license key");
      return;
    }

    if (!deviceId) {
      Alert.alert("Error", "Device ID not available. Please restart the app.");
      return;
    }

    setLoading(true);

    try {
      // ============================================
      // STEP 1: Check if license key is valid (GET API)
      // ============================================
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/melonelite/`;

      console.log("Validating license key:", licenseKey.trim());
      const checkResponse = await fetch(CHECK_LICENSE_API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const checkData = await checkResponse.json();
      console.log("Check response:", checkData);

      // Check if API call was successful
      if (!checkResponse.ok || !checkData.success) {
        Alert.alert(
          "Error",
          checkData.message || "Failed to validate license. Please try again."
        );
        setLoading(false);
        return;
      }

      // Check if customer exists
      let customer: any = null;
      let isDemo = false;

      // 1. Check Normal Customers
      if (checkData.customers && checkData.customers.length > 0) {
        customer = checkData.customers.find(
          (c: any) => c.license_key === licenseKey.trim()
        );
      }

      // 2. Check Demo Licenses
      if (!customer && checkData.demo_licenses && checkData.demo_licenses.length > 0) {
        const demoMatch = checkData.demo_licenses.find(
          (d: any) => d.demo_license === licenseKey.trim()
        );

        if (demoMatch) {
          isDemo = true;
          // Map demo object to customer-like object for consistency
          customer = {
            customer_name: demoMatch.company,
            client_id: demoMatch.client_id,
            license_key: demoMatch.demo_license,
            license_summary: {
              registered_devices: 0, // Demos might not track this, or need separate logic. Assuming 0 for now or handled by API.
              max_devices: demoMatch.demo_login_limit || 1
            },
            registered_devices: [], // Assuming empty for new demo checks
            expires_at: demoMatch.expires_at
          };
        }
      }

      if (!customer) {
        Alert.alert(
          "Invalid License",
          "The license key you entered is not valid"
        );
        setLoading(false);
        return;
      }

      // IF DEMO: Show alert
      if (isDemo) {
        let daysRemaining: number | string = "Unknown";
        if (customer.expires_at) {
          const now = new Date();
          const expiry = new Date(customer.expires_at);
          const diffTime = expiry.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          daysRemaining = diffDays > 0 ? diffDays : 0;
        }

        Alert.alert(
          "Demo License",
          `You are now in demo mode. Your license will expire on ${customer.expires_at} (${daysRemaining} days remaining)`,
          [{ text: "OK" }]
        );
      }


      // Check if this device is already registered for this license
      const isAlreadyRegistered = customer.registered_devices?.some(
        (device: any) => device.device_id === deviceId
      );

      if (isAlreadyRegistered) {
        // Device already registered, add to licenses array
        await AsyncStorage.setItem("licenseActivated", "true");
        await AsyncStorage.setItem("deviceId", deviceId);
        await AsyncStorage.setItem("projectName", checkData.project_name);

        // Add to licenses array
        await addLicenseToStorage({
          license_key: licenseKey.trim(),
          client_id: customer.client_id,
          shop_name: customer.customer_name,
          customer_name: customer.customer_name,
          modules: customer.modules || [],
          isDemo: isDemo,
          expires_at: isDemo ? customer.expires_at : null
        });

        // Set as current license ONLY if in adding mode (don't overwrite existing)
        if (isAddingLicense && !isUpgradeMode) {
          // Don't change current license, just add to array
          console.log("✅ License added to array, keeping current license active");
        } else {
          // First license OR Upgrade mode - set as current
          console.log("🔄 Setting as current main license (Already Registered branch)");
          await AsyncStorage.setItem("licenseKey", licenseKey.trim());
          await AsyncStorage.setItem("clientId", customer.client_id);
          await AsyncStorage.setItem("customerName", customer.customer_name);
          if (customer.modules) {
            await AsyncStorage.setItem("activatedModules", JSON.stringify(customer.modules));
          }
          
          if (isDemo) {
            // DEMO: Save only to demo-specific keys
            await AsyncStorage.setItem("license_type", "demo");
            await AsyncStorage.setItem("demo_key", licenseKey.trim());
            await AsyncStorage.setItem("demo_expiry", customer.expires_at || "");
            await AsyncStorage.setItem("demo_company", customer.customer_name || "");
            await AsyncStorage.setItem("demo_client_id", customer.client_id || "");
            // Clear any leftover real license data
            await AsyncStorage.removeItem("real_license_key");
            await AsyncStorage.removeItem("real_customer_name");
            await AsyncStorage.removeItem("real_client_id");
            await AsyncStorage.removeItem("real_expiry");
            await AsyncStorage.removeItem("real_status");
          } else {
            // REAL LICENSE: Save only to real-specific keys
            await AsyncStorage.setItem("license_type", "real");
            await AsyncStorage.setItem("real_license_key", licenseKey.trim());
            await AsyncStorage.setItem("real_customer_name", customer.customer_name || "");
            await AsyncStorage.setItem("real_client_id", customer.client_id || "");
            await AsyncStorage.setItem("real_status", customer.status || "Active");
            if (customer.license_validity) {
              await AsyncStorage.setItem("real_expiry", customer.license_validity.expiry_date || "");
              await AsyncStorage.setItem("real_is_expired", customer.license_validity.is_expired ? "true" : "false");
            }
            // Clear demo data
            await AsyncStorage.removeItem("demo_key");
            await AsyncStorage.removeItem("demo_expiry");
            await AsyncStorage.removeItem("demo_company");
            await AsyncStorage.removeItem("demo_client_id");
          }
          // Shared: licenseKey for routing checks
          await AsyncStorage.setItem("licenseKey", licenseKey.trim());
          await AsyncStorage.setItem("licenseActivated", "true");
        }

        console.log("✅ Device already registered");
        console.log("✅ Stored client_id:", customer.client_id);

        Alert.alert(
          "Already Registered",
          `${customer.customer_name} license has been added successfully!`,
          [
            {
              text: "Continue",
              onPress: () => {
                if (onActivationSuccess) {
                  onActivationSuccess();
                } else {
                  router.replace('/(tabs)');
                }
              },
            },
          ]
        );
        setLoading(false);
        return;
      }

      // Check if device limit reached
      if (customer.license_summary.registered_devices >= customer.license_summary.max_devices) {
        Alert.alert(
          "License Limit Reached",
          `Maximum devices (${customer.license_summary.max_devices}) already registered for this license`
        );
        setLoading(false);
        return;
      }

      // ============================================
      // STEP 2: Register device (POST API)
      // ============================================
      const POST_DEVICE_API = `https://activate.imcbs.com/mobileapp/api/project/melonelite/license/register/`;

      console.log("📤 Registering new device...");
      console.log("Platform:", Platform.OS);
      console.log("Is Physical Device:", Device.isDevice);
      console.log("License Key:", licenseKey.trim());
      console.log("Device ID:", deviceId);
      console.log("Device Name:", deviceName);

      const deviceResponse = await fetch(POST_DEVICE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          device_id: deviceId,
          device_name: deviceName,
        }),
      });

      const responseText = await deviceResponse.text();
      console.log("Raw response:", responseText);

      let deviceData;
      try {
        deviceData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        Alert.alert(
          "Error",
          "Invalid response from server. Please contact support."
        );
        setLoading(false);
        return;
      }

      console.log("Device registration response:", deviceData);

      if (deviceResponse.ok && deviceData.success) {
        // Success - store activation status and add to licenses array
        await AsyncStorage.setItem("licenseActivated", "true");
        await AsyncStorage.setItem("deviceId", deviceId);
        await AsyncStorage.setItem("projectName", checkData.project_name);

        // Add to licenses array
        await addLicenseToStorage({
          license_key: licenseKey.trim(),
          client_id: customer.client_id,
          shop_name: customer.customer_name,
          customer_name: customer.customer_name,
          modules: customer.modules || [],
          isDemo: isDemo,
          expires_at: isDemo ? customer.expires_at : null
        });

        // Set as current license ONLY if in adding mode (don't overwrite existing)
        if (isAddingLicense && !isUpgradeMode) {
          // Don't change current license, just add to array
          console.log("✅ License added to array, keeping current license active");
        } else {
          // First license OR Upgrade mode - set as current
          await AsyncStorage.setItem("licenseKey", licenseKey.trim());
          await AsyncStorage.setItem("clientId", customer.client_id);
          await AsyncStorage.setItem("customerName", customer.customer_name);
          if (customer.modules) {
            await AsyncStorage.setItem("activatedModules", JSON.stringify(customer.modules));
          }
          console.log("🎟️ Activating License - isDemo:", isDemo);
          if (isDemo) {
            // DEMO: Save only to demo-specific keys
            await AsyncStorage.setItem("license_type", "demo");
            await AsyncStorage.setItem("demo_key", licenseKey.trim());
            await AsyncStorage.setItem("demo_expiry", customer.expires_at || "");
            await AsyncStorage.setItem("demo_company", customer.customer_name || "");
            await AsyncStorage.setItem("demo_client_id", customer.client_id || "");
            // Clear real license data
            await AsyncStorage.removeItem("real_license_key");
            await AsyncStorage.removeItem("real_customer_name");
            await AsyncStorage.removeItem("real_client_id");
            await AsyncStorage.removeItem("real_expiry");
            await AsyncStorage.removeItem("real_status");
          } else {
            // REAL LICENSE: Save only to real-specific keys
            await AsyncStorage.setItem("license_type", "real");
            await AsyncStorage.setItem("real_license_key", licenseKey.trim());
            await AsyncStorage.setItem("real_customer_name", customer.customer_name || "");
            await AsyncStorage.setItem("real_client_id", customer.client_id || "");
            await AsyncStorage.setItem("real_status", customer.status || "Active");
            if (customer.license_validity) {
              await AsyncStorage.setItem("real_expiry", customer.license_validity.expiry_date || "");
              await AsyncStorage.setItem("real_is_expired", customer.license_validity.is_expired ? "true" : "false");
            }
            // Clear demo data
            await AsyncStorage.removeItem("demo_key");
            await AsyncStorage.removeItem("demo_expiry");
            await AsyncStorage.removeItem("demo_company");
            await AsyncStorage.removeItem("demo_client_id");
          }
          // Shared routing key
          await AsyncStorage.setItem("licenseKey", licenseKey.trim());
        }

        console.log("✅ Device registered successfully!");
        console.log("✅ Stored client_id:", customer.client_id);
        console.log("✅ Registered Device ID:", deviceId);

        Alert.alert(
          "Success",
          `${customer.customer_name} license has been added successfully!`,
          [
            {
              text: "Continue",
              onPress: () => {
                if (onActivationSuccess) {
                  onActivationSuccess();
                } else {
                  router.replace('/(tabs)');
                }
              },
            },
          ]
        );
      } else {
        // Handle error from device registration API
        const errorMessage = deviceData.message
          || deviceData.error
          || deviceData.detail
          || "Failed to register device. Please try again.";

        console.error("❌ Registration failed:", errorMessage);

        Alert.alert(
          "Registration Failed",
          errorMessage
        );
      }
    } catch (error: any) {
      console.error("Activation error:", error);

      let errorMessage = "Network error. Please check your connection and try again.";

      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      if (error.name === "TypeError" && error.message.includes("Network request failed")) {
        errorMessage = "Cannot connect to server. Please check your internet connection.";
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateDemo = async () => {
    if (!demoShopName.trim() || !demoPhone.trim()) {
      Alert.alert("Required", "Please enter both Shop Name and Phone Number");
      return;
    }

    setLoading(true);
    try {
      // 1. Check for existing demo
      const existingExpiry = await AsyncStorage.getItem("demoExpiresAt");
      let expiry: Date;

      if (existingExpiry) {
        expiry = new Date(existingExpiry);
        if (expiry.getTime() < Date.now()) {
          Alert.alert("Demo Expired", "Your 5-day demo has expired. Please activate a full license.");
          setLoading(false);
          return;
        }
        console.log("🔄 Continuing existing demo until:", expiry.toISOString());
      } else {
        // Create new demo expiry
        expiry = new Date();
        expiry.setDate(expiry.getDate() + 5);
        console.log("🆕 Starting new 5-day demo...");
      }

      // 2. Send WhatsApp Message (Only if new demo)
      if (!existingExpiry) {
        const MSG = `melonlite enquiry \nshopname : ${demoShopName}\nphone number : ${demoPhone}`;
        const encodedMsg = encodeURIComponent(MSG);
        
        console.log("📤 Sending Demo Enquiry to WhatsApp recipients...");
        const recipients = ["9072791379", "9946545535"];
        
        await Promise.all(recipients.map(recipient => {
          const url = `https://app.dxing.in/api/send/whatsapp?secret=4d8911f61a3eff1123ba4b11408f66697ab8bdf5&account=1778132749812b4ba287f5ee0bc9d43bbf5bbe87fb69fc270dc7c77&recipient=${recipient}&type=text&message=${encodedMsg}&priority=1`;
          return fetch(url).catch(err => console.error(`Failed to send to ${recipient}:`, err));
        }));
      }

      // 3. Setup Demo Data using new clean keys
      const demoKey = "DEMO-" + Math.random().toString(36).substring(7).toUpperCase();
      const demoClientId = "DEMO_" + Date.now();

      await AsyncStorage.setItem("licenseActivated", "true");
      await AsyncStorage.setItem("licenseKey", demoKey);          // Shared routing key
      await AsyncStorage.setItem("license_type", "demo");         // Clean type flag
      await AsyncStorage.setItem("demo_key", demoKey);
      await AsyncStorage.setItem("demo_expiry", expiry.toISOString());
      await AsyncStorage.setItem("demo_company", demoShopName);
      await AsyncStorage.setItem("demo_client_id", demoClientId);
      await AsyncStorage.setItem("demoUsed", "true");             // Prevent re-use
      // Clear any leftover real license data
      await AsyncStorage.multiRemove(["real_license_key", "real_customer_name", "real_client_id", "real_expiry", "real_status"]);

      Alert.alert(
        existingExpiry ? "Demo Restored" : "Demo Activated",
        `Welcome! Your demo expires on ${expiry.toLocaleDateString()}.`,
        [{ text: "Start Using App", onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error) {
      console.error("Demo activation error:", error);
      Alert.alert("Error", "Failed to activate demo. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while checking registration
  if (checking) {
    return (
      <LinearGradient
        colors={["#0D0D0D", "#1C1C1E"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <View style={styles.checkingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.checkingText}>Checking registration...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#0D0D0D", "#1C1C1E"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {(isAddingLicense || isUpgradeMode) && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => isUpgradeMode ? router.back() : (onActivationSuccess && onActivationSuccess())}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>MeloneLite Setup</Text>
        <Text style={styles.subtitle}>Enter your license key to activate the POS system</Text>

        {/* Device Info Display */}
        <View style={styles.deviceInfoContainer}>
          <View style={styles.deviceInfoRow}>
            <Text style={styles.deviceInfoLabel}>Device Type</Text>
            <Text style={styles.deviceInfoBadge}>
              {Device.isDevice ? "Physical Device" : "Emulator/Simulator"}
            </Text>
          </View>
          <Text style={styles.deviceInfoLabel}>Device ID</Text>
          <Text style={styles.deviceInfoText} numberOfLines={2}>
            {deviceId || "Loading..."}
          </Text>
          <Text style={[styles.deviceInfoLabel, { marginTop: 12 }]}>Device Name</Text>
          <Text style={styles.deviceInfoText} numberOfLines={1}>
            {deviceName || "Loading..."}
          </Text>
        </View>

        {/* License Key Input (Only if not demo mode) */}
        {!showDemoForm ? (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>License Key</Text>
              <TextInput
                style={styles.input}
                value={licenseKey}
                onChangeText={setLicenseKey}
                placeholder="Enter license key"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Activate Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleActivate}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#0D0D0D" />
                  <Text style={styles.loadingText}>Validating...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Activate License</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.demoLink} 
              onPress={() => {
                if (demoUsed && demoRemainingDays === null) {
                  Alert.alert("Demo Expired", "Your 5-day demo has expired. Please activate a full license.");
                } else if (demoRemainingDays !== null) {
                  handleActivateDemo(); // Resume immediately
                } else {
                  setShowDemoForm(true);
                }
              }}
              disabled={loading}
            >
              <Text style={styles.demoLinkText}>
                {demoRemainingDays !== null 
                  ? `Continue Demo (${demoRemainingDays} days left)` 
                  : (demoUsed ? "Demo Expired" : "Try Demo for 5 Days")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Shop Name</Text>
              <TextInput
                style={styles.input}
                value={demoShopName}
                onChangeText={setDemoShopName}
                placeholder="Enter your shop name"
                placeholderTextColor="#666"
                editable={!loading}
              />
              
              <Text style={[styles.inputLabel, { marginTop: 20 }]}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={demoPhone}
                onChangeText={setDemoPhone}
                placeholder="Enter phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#FFD700' }, loading && styles.buttonDisabled]}
              onPress={handleActivateDemo}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.buttonText}>Start 5-Day Demo</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.demoLink} 
              onPress={() => setShowDemoForm(false)}
              disabled={loading}
            >
              <Text style={styles.demoLinkText}>Back to License Key</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.footerText}>
          By activating, you agree to our terms of service
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  checkingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checkingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
  },
  title: {
    fontSize: 28,
    fontFamily: "Poppins-Bold",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginBottom: 40,
  },
  deviceInfoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  deviceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deviceInfoLabel: {
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    color: "#8E8E93",
    marginBottom: 4,
  },
  deviceInfoBadge: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    color: "#FFD700",
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deviceInfoText: {
    fontSize: 12,
    color: "#E5E5E7",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "Poppins-Medium",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: "#fff",
    fontFamily: "Poppins-Regular",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  button: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontFamily: "Poppins-Bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    padding: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  demoLink: {
    alignItems: 'center',
    padding: 10,
  },
  demoLinkText: {
    color: '#FFD700',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    textDecorationLine: 'underline',
  },
});
