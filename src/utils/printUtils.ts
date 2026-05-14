import { Order, OrderItem } from '../db/ordersDB';
import { Settings } from '../db/settingsDB';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const formatCurrency = (amount: number, symbol: string = '₹') =>
  `${symbol}${amount.toFixed(2)}`;

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const generateReceiptHTML = (
  order: Order,
  items: OrderItem[],
  settings: Settings,
  isPdf: boolean = false
): string => {
  const sym = settings.currency_symbol || '₹';

  if (isPdf) {
    // Standard A4 Invoice Format for PDF sharing
    const itemRows = items.map((item, index) => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #eee;">${index + 1}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${item.item_name}</td>
        <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${item.quantity}</td>
        <td style="padding:10px; text-align:right; border-bottom:1px solid #eee;">${formatCurrency(item.rate, sym)}</td>
        <td style="padding:10px; text-align:right; border-bottom:1px solid #eee; font-weight:bold;">${formatCurrency(item.subtotal, sym)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0 auto;
            padding: 40px;
            background: #fff;
            color: #333;
            max-width: 800px;
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .restaurant-info { flex: 1; }
          .restaurant-name { font-size: 28px; font-weight: bold; color: #000; margin-bottom: 5px; }
          .restaurant-sub { font-size: 14px; color: #666; margin-top: 3px; }
          .invoice-title { font-size: 32px; font-weight: bold; color: #333; text-transform: uppercase; text-align: right; }
          
          .order-details { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .order-info-block p { font-size: 14px; margin: 5px 0; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { font-size: 14px; text-align: left; padding: 12px 10px; background: #333; color: #fff; text-transform: uppercase; }
          th:nth-child(3) { text-align: center; }
          th:nth-child(4), th:nth-child(5) { text-align: right; }
          
          .totals-container { display: flex; justify-content: flex-end; }
          .totals { width: 300px; }
          .totals p { font-size: 14px; display: flex; justify-content: space-between; margin: 8px 0; padding: 4px 10px; }
          .grand-total { font-size: 20px; font-weight: bold; background: #333; color: #fff; display: flex; justify-content: space-between; padding: 12px 10px; border-radius: 4px; margin-top: 10px; }
          
          .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="restaurant-info">
            <div class="restaurant-name">${settings.restaurant_name || 'Restaurant'}</div>
            ${settings.restaurant_address ? `<div class="restaurant-sub">${settings.restaurant_address}</div>` : ''}
            ${settings.restaurant_phone ? `<div class="restaurant-sub">Phone: ${settings.restaurant_phone}</div>` : ''}
          </div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <div class="order-details">
          <div class="order-info-block">
            <p><strong>Invoice No:</strong> #${order.order_number}</p>
            <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
          </div>
          <div class="order-info-block" style="text-align: right;">
            ${order.table_no ? `<p><strong>Table:</strong> ${order.table_no}</p>` : ''}
            ${order.customer_name ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
            <p><strong>Payment Method:</strong> ${order.payment_method}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th width="10%">#</th>
              <th width="40%">Item Description</th>
              <th width="10%">Qty</th>
              <th width="20%">Price</th>
              <th width="20%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals">
            <p><span>Subtotal:</span><span>${formatCurrency(order.subtotal, sym)}</span></p>
            ${order.discount > 0 ? `<p><span>Discount:</span><span style="color:red;">- ${formatCurrency(order.discount, sym)}</span></p>` : ''}
            <div class="grand-total">
              <span>Total Amount</span>
              <span>${formatCurrency(order.grand_total, sym)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>${settings.receipt_footer || 'Thank you for your business!'}</p>
          <p style="margin-top:8px;">Powered by MeloneLite</p>
        </div>
      </body>
      </html>
    `;
  } else {
    // Thermal Receipt Format (280px width)
    const itemRows = items.map(item => `
      <tr>
        <td style="padding:4px 2px; font-size:11px; border-bottom:1px dashed #ccc;">${item.item_name}</td>
        <td style="padding:4px 2px; font-size:11px; text-align:center; border-bottom:1px dashed #ccc;">${item.quantity}</td>
        <td style="padding:4px 2px; font-size:11px; text-align:right; border-bottom:1px dashed #ccc;">${formatCurrency(item.rate, sym)}</td>
        <td style="padding:4px 2px; font-size:11px; text-align:right; border-bottom:1px dashed #ccc;">${formatCurrency(item.subtotal, sym)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
            background: #fff;
            color: #000;
            font-size: 12px;
          }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; }
          .restaurant-name { font-size: 18px; font-weight: bold; font-family: Arial, sans-serif; }
          .restaurant-sub { font-size: 10px; color: #444; margin-top: 2px; }
          .order-info { margin: 8px 0; border-bottom: 1px dashed #999; padding-bottom: 6px; }
          .order-info p { font-size: 11px; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { font-size: 10px; text-align: left; padding: 3px 2px; border-bottom: 2px solid #000; border-top: 1px solid #000; text-transform: uppercase; }
          th:nth-child(2) { text-align: center; }
          th:nth-child(3), th:nth-child(4) { text-align: right; }
          .totals { margin-top: 6px; border-top: 1px dashed #999; padding-top: 6px; }
          .totals p { font-size: 11px; display: flex; justify-content: space-between; margin: 3px 0; }
          .grand-total { font-size: 15px; font-weight: bold; border-top: 2px solid #000; margin-top: 5px; padding-top: 5px; display: flex; justify-content: space-between; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; border-top: 1px dashed #999; padding-top: 8px; }
          .divider { border-top: 1px dashed #999; margin: 6px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="restaurant-name">${settings.restaurant_name || 'Restaurant'}</div>
          ${settings.restaurant_address ? `<div class="restaurant-sub">${settings.restaurant_address}</div>` : ''}
          ${settings.restaurant_phone ? `<div class="restaurant-sub">Ph: ${settings.restaurant_phone}</div>` : ''}
        </div>

        <div class="order-info">
          <p><strong>Order #:</strong> ${order.order_number}</p>
          <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
          ${order.table_no ? `<p><strong>Table:</strong> ${order.table_no}</p>` : ''}
          ${order.customer_name ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
          <p><strong>Payment:</strong> ${order.payment_method}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amt</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="totals">
          <p><span>Subtotal:</span><span>${formatCurrency(order.subtotal, sym)}</span></p>
          ${order.discount > 0 ? `<p><span>Discount:</span><span>- ${formatCurrency(order.discount, sym)}</span></p>` : ''}
          <div class="grand-total">
            <span>TOTAL</span>
            <span>${formatCurrency(order.grand_total, sym)}</span>
          </div>
        </div>

        <div class="footer">
          <p>${settings.receipt_footer || 'Thank you for dining with us!'}</p>
          <p style="margin-top:4px;">Powered by MeloneLite</p>
        </div>
      </body>
      </html>
    `;
  }
};

export const printReceipt = async (
  order: Order,
  items: OrderItem[],
  settings: Settings
): Promise<void> => {
  const html = generateReceiptHTML(order, items, settings, false);
  await Print.printAsync({ html });
};

export const sharePDF = async (
  order: Order,
  items: OrderItem[],
  settings: Settings
): Promise<void> => {
  const html = generateReceiptHTML(order, items, settings, true);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Bill - ${order.order_number}`,
      UTI: 'com.adobe.pdf',
    });
  }
};
