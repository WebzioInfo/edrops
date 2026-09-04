import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatOrderStatus, formatDeliverySlot, formatPaymentDetails } from './orderFormatters';
import { EDROPS_LOGO_PNG } from '../assets/logoBase64';

export function generateOrderInvoice(order: any) {
  if (!order) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  type RGB = [number, number, number];
  const primaryBlue: RGB = [30, 136, 229]; // #1E88E5
  const darkSlate: RGB = [15, 23, 42];    // #0F172A
  const mutedSlate: RGB = [100, 116, 139]; // #64748B
  const lightGray: RGB = [226, 232, 240];  // #E2E8F0

  // 1. BRAND HEADER (Full Logo Lockup + Tagline)
  try {
    doc.addImage(EDROPS_LOGO_PNG, 'PNG', margin, 11, 38, 8.8);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('EDROPS', margin, 20);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Pure Water. Delivered Daily.', margin, 25);

  // Top-Right "INVOICE / RECEIPT"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('INVOICE / RECEIPT', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  const formattedDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  doc.text(`Date: ${formattedDate}`, pageWidth - margin, 26, { align: 'right' });

  // Accent Line
  doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, 31, pageWidth - margin, 31);

  // 2. ORDER META & BILLED TO (Two columns)
  const metaY = 38;

  // Left Column: Billed To & Delivery Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('BILLED TO / DELIVER TO', margin, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const customerName = `${order.customer?.user?.firstName || ''} ${order.customer?.user?.lastName || ''}`.trim() || 'Valued Customer';
  doc.text(customerName, margin, metaY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  
  let addressTextY = metaY + 9.5;
  if (order.customer?.user?.phone) {
    doc.text(`Phone: ${order.customer.user.phone}`, margin, addressTextY);
    addressTextY += 4.5;
  }
  if (order.address) {
    doc.text(`${order.address.street || ''}, ${order.address.city || ''} ${order.address.zipCode || ''}`.trim(), margin, addressTextY);
  } else {
    doc.text('Saved Account Address', margin, addressTextY);
  }

  // Right Column: Order Details
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('ORDER DETAILS', rightColX, metaY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const shortId = (order.id || '').substring(0, 8).toUpperCase();
  doc.text(`Order ID: #${shortId}`, rightColX, metaY + 5);
  
  const paymentDetails = formatPaymentDetails(order);
  doc.text(`Payment: ${paymentDetails.fullLabel}`, rightColX, metaY + 9.5);
  doc.text(`Delivery Slot: ${formatDeliverySlot(order.timeSlot)}`, rightColX, metaY + 14);
  doc.text(`Status: ${formatOrderStatus(order.status)}`, rightColX, metaY + 18.5);

  // 3. TABLE OF LINE ITEMS
  const tableStartY = metaY + 24;

  const tableRows = (order.items || []).map((item: any, idx: number) => {
    const productName = item.product?.name || 'Water Product';
    const brandName = item.product?.brand?.name ? ` (${item.product.brand.name})` : '';
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const deposit = Number(item.deposit || 0);
    const lineTotal = unitPrice * qty + deposit;

    return [
      String(idx + 1),
      `${productName}${brandName}`,
      String(qty),
      `Rs. ${unitPrice.toFixed(2)}`,
      deposit > 0 ? `Rs. ${deposit.toFixed(2)}` : '—',
      `Rs. ${lineTotal.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Deposit', 'Total']],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [30, 136, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    styles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      cellPadding: 3,
      lineColor: lightGray,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 28 },
    },
  });

  // 4. SUMMARY BLOCK (Right aligned below table)
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  const subTotal = Number(order.subTotal) || order.items?.reduce((sum: number, i: any) => sum + (Number(i.unitPrice || i.price || 0) * (Number(i.quantity) || 1)), 0) || 0;
  const depositTotal = Number(order.depositTotal) || 0;
  const deliveryCharge = Number(order.deliveryCharge) || 0;
  const discountTotal = Number(order.discountTotal) || 0;
  const grandTotal = Number(order.totalAmount) || (subTotal + depositTotal + deliveryCharge - discountTotal);

  doc.setFontSize(8.5);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);

  let currentY = finalY;

  // Subtotal
  doc.text('Items Subtotal:', summaryX, currentY);
  doc.text(`Rs. ${subTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 5;

  // Deposit
  if (depositTotal > 0) {
    doc.text('Security Deposit:', summaryX, currentY);
    doc.text(`Rs. ${depositTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 5;
  }

  // Delivery
  doc.text('Delivery Fee:', summaryX, currentY);
  doc.text(deliveryCharge === 0 ? 'FREE' : `Rs. ${deliveryCharge.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 5;

  // Promo Discount
  if (discountTotal > 0) {
    doc.setTextColor(16, 185, 129); // emerald green
    doc.text('Promo Discount:', summaryX, currentY);
    doc.text(`-Rs. ${discountTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 5;
  }

  // Divider Line
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setLineWidth(0.4);
  doc.line(summaryX, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Grand Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Grand Total:', summaryX, currentY);
  doc.text(`Rs. ${grandTotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });

  // 5. FOOTER
  const footerY = pageHeight - 20;

  doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(
    'Thank you for choosing Edrops! For support or inquiries, visit edrops.in/support or email support@edrops.in',
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );
  doc.setFontSize(7);
  doc.text(
    'This is a computer-generated invoice and requires no physical signature.',
    pageWidth / 2,
    footerY + 9,
    { align: 'center' }
  );

  // Save the generated PDF
  doc.save(`Edrops-Order-${shortId}.pdf`);
}
