/**
 * backgroundSync.js
 *
 * Handles background sync of unsynced orders to the API.
 * - syncOrders(): reads unsynced orders from SQLite, POSTs to API, marks as synced on success.
 * - initBackgroundSync(): configures react-native-background-fetch to run syncOrders every 15 minutes.
 *
 * NEVER throws or crashes the app. All errors are caught silently.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from './src/db/database';
import BackgroundFetch from 'react-native-background-fetch';
import CONFIG from './config';

// ─── Sync Function ──────────────────────────────────────────────────────────

export async function syncOrders() {
  try {
    // 1. Get staff_id from AsyncStorage
    const staffId = await AsyncStorage.getItem('staff_id');
    if (!staffId || staffId.trim() === '') {
      // Not logged in yet — skip
      return;
    }

    // 2. Open the existing SQLite database
    const db = getDB();

    // 3. Query all unsynced orders
    let unsyncedOrders = [];
    try {
      unsyncedOrders = db.getAllSync('SELECT * FROM orders WHERE synced = 0');
    } catch (dbErr) {
      // Table may not have the synced column yet (migration pending) — skip safely
      return;
    }

    if (!unsyncedOrders || unsyncedOrders.length === 0) {
      // Nothing to sync
      return;
    }

    // Attach items and map grand_total to total
    const ordersPayload = [];
    for (const order of unsyncedOrders) {
      let items = [];
      try {
        items = db.getAllSync('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      } catch (e) {
        // ignore
      }
      ordersPayload.push({
        ...order,
        total: order.grand_total || 0,
        items: items
      });
    }

    // 4. POST to API
    const response = await fetch(`${CONFIG.BASE_URL}/api/sync/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        staff_id: staffId,
        orders: ordersPayload,
      }),
    });

    const data = await response.json();

    // 5. On success, mark orders as synced
    if (data.success === true) {
      const ids = unsyncedOrders.map(o => o.id);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.runSync(
          `UPDATE orders SET synced = 1 WHERE id IN (${placeholders})`,
          ids
        );
      }
    }
    // If API returns success: false, do nothing — will retry next cycle
  } catch (e) {
    // Any network error, DB error, etc. — silently ignore, retry next cycle
  }
}

// ─── Background Fetch Initializer ───────────────────────────────────────────

export function initBackgroundSync() {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,       // minutes
      stopOnTerminate: false,         // continue after app is terminated (Android)
      startOnBoot: true,              // start after device reboot
      enableHeadless: true,           // allow headless execution (Android)
      forceAlarmManager: false,       // use JobScheduler on Android (recommended)
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId) => {
      // This is the background fetch callback
      try {
        await syncOrders();
      } catch (e) {
        // Silently ignore
      }
      // IMPORTANT: Signal completion to the OS
      BackgroundFetch.finish(taskId);
    },
    (taskId) => {
      // Timeout callback — task took too long, must finish immediately
      BackgroundFetch.finish(taskId);
    }
  );
}
