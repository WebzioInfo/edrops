import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EDROPS_LOGO_PNG } from '../../../assets/logoBase64';
import { ROBOTO_REGULAR_BASE64, ROBOTO_MEDIUM_BASE64 } from '../../../assets/fonts/robotoBase64';

export interface ReportPdfData {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  rangeLabel: string;
  dateStart: Date;
  dateEnd: Date;
  kpis: {
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    totalOrderAmount: number;
    paidOrderAmount: number;
    pendingOrderAmount: number;
    paidOrdersCount: number;
    partialOrdersCount: number;
    unpaidOrdersCount: number;
    avgOrderValue: number;
    totalPurchases: number;
    totalPurchaseAmount: number;
    totalPurchasePaid: number;
    totalPurchasePending: number;
    fullyPaidPurchasesCount: number;
    partialPurchasesCount: number;
    pendingPurchasesCount: number;
    avgPurchaseValue: number;
    totalSuppliers: number;
    activeSuppliers: number;
    suppliersWithPurchases: number;
    suppliersWithOutstanding: number;
    totalSupplierOutstanding: number;
  };
  insights: Array<{
    title: string;
    entityName: string;
    value: string;
    subtext?: string;
  }>;
  dailyData: {
    orderDailyData: Array<{
      date: string;
      label: string;
      primaryValue: number;
      secondaryValue?: number;
      meta?: { count?: number; paid?: number; pending?: number };
    }>;
    purchaseDailyData: Array<{
      date: string;
      label: string;
      primaryValue: number;
      secondaryValue?: number;
      meta?: { count?: number; paid?: number; pending?: number };
    }>;
  };
  orders: Array<{
    id: string;
    createdAt: string;
    customerName: string;
    companyName?: string | null;
    phone?: string | null;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    paymentStatus: string;
    status: string;
    itemsCount: number;
  }>;
  purchases: Array<{
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
    supplierName: string;
    itemsCount: number;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    pendingAmount: number;
    paymentStatus: string;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    companyName?: string | null;
    purchasesInRange: number;
    totalInRange: number;
    paidInRange: number;
    pendingInRange: number;
    balance: number;
    lastPurchasedAt: string | null;
  }>;
  customers: Array<{
    customerId: string;
    customerName: string;
    companyName?: string | null;
    phone?: string | null;
    orderCount: number;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    averageOrderValue: number;
    lastOrderDate: string;
  }>;
}

export function formatPdfCurrency(val: number | null | undefined): string {
  const n = Number(val || 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatPdfDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function generateDistributorReportPDF(data: ReportPdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register TrueType Unicode fonts for full Indian Rupee (₹) symbol support
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Medium.ttf', ROBOTO_MEDIUM_BASE64);
  doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryBlue: [number, number, number] = [22, 119, 200];  // #1677C8
  const darkSlate: [number, number, number] = [15, 23, 42];      // #0F172A
  const slateText: [number, number, number] = [51, 65, 85];      // #334155
  const mutedSlate: [number, number, number] = [100, 116, 139];  // #64748B
  const borderGray: [number, number, number] = [226, 232, 240];  // #E2E8F0
  const lightBg: [number, number, number] = [248, 250, 252];     // #F8FAFC

  const now = new Date();
  const nowFormatted = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' at ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isoDate = now.toISOString().split('T')[0];

  // ─────────────────────────────────────────────────────────────────────────
  // 1. BRAND HEADER (Logo + Title)
  // ─────────────────────────────────────────────────────────────────────────
  let currentY = 12;

  try {
    doc.addImage(EDROPS_LOGO_PNG, 'PNG', margin, currentY, 36, 8.3);
  } catch {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('edrops', margin, currentY + 7);
  }

  // Right-aligned report header
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('EDROPS DISTRIBUTOR MANAGEMENT', pageWidth - margin, currentY + 2, { align: 'right' });

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Executive Business Report', pageWidth - margin, currentY + 7.5, { align: 'right' });

  // Accent Line
  currentY += 12;
  doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setLineWidth(0.7);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. METADATA SUMMARY BAR
  // ─────────────────────────────────────────────────────────────────────────
  currentY += 3;
  const metaBoxHeight = 16;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, metaBoxHeight, 1.5, 1.5, 'FD');

  const colWidth = contentWidth / 4;
  const metaY = currentY + 5;

  // Distributor
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text('DISTRIBUTOR', margin + 3, metaY);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const distName = `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || 'Distributor Partner';
  doc.text(distName, margin + 3, metaY + 6);

  // Contact
  const col2X = margin + colWidth;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text('CONTACT INFO', col2X + 2, metaY);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  const contactStr = data.user.phone || data.user.email || '—';
  doc.text(contactStr, col2X + 2, metaY + 6);

  // Report Period
  const col3X = margin + colWidth * 2;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text('REPORTING PERIOD', col3X + 2, metaY);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text(data.rangeLabel, col3X + 2, metaY + 6);

  // Generated Timestamp
  const col4X = margin + colWidth * 3;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text('GENERATED ON', col4X + 2, metaY);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateText[0], slateText[1], slateText[2]);
  doc.text(nowFormatted, col4X + 2, metaY + 6);

  currentY += metaBoxHeight + 5;

  // ─────────────────────────────────────────────────────────────────────────
  // Helper to draw section headings cleanly
  // ─────────────────────────────────────────────────────────────────────────
  const drawSectionHeading = (title: string, yPos: number): number => {
    // If getting close to page bottom, page break
    if (yPos > pageHeight - 35) {
      doc.addPage();
      yPos = 16;
    }
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(title, margin, yPos);

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
    return yPos + 5;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3. EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  currentY = drawSectionHeading('1. Executive Financial Summary', currentY);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value', 'Fulfillment / Details', 'Category']],
    body: [
      ['Total Orders', String(data.kpis.totalOrders), `${data.kpis.completedOrders} Delivered · ${data.kpis.pendingOrders} Pending · ${data.kpis.cancelledOrders} Cancelled`, 'Orders'],
      ['Total Order Amount', formatPdfCurrency(data.kpis.totalOrderAmount), `Average Order Value: ${formatPdfCurrency(data.kpis.avgOrderValue)}`, 'Orders'],
      ['Amount Collected', formatPdfCurrency(data.kpis.paidOrderAmount), `${data.kpis.paidOrdersCount} Paid in Full · ${data.kpis.partialOrdersCount} Partially Paid`, 'Financial Flow'],
      ['Pending / Due Amount', formatPdfCurrency(data.kpis.pendingOrderAmount), `${data.kpis.unpaidOrdersCount} Unpaid Orders`, 'Financial Flow'],
      ['Procurement Purchases', String(data.kpis.totalPurchases), `Across ${data.kpis.suppliersWithPurchases} active suppliers in period`, 'Procurement'],
      ['Total Purchase Value', formatPdfCurrency(data.kpis.totalPurchaseAmount), `Average Purchase: ${formatPdfCurrency(data.kpis.avgPurchaseValue)}`, 'Procurement'],
      ['Paid to Suppliers', formatPdfCurrency(data.kpis.totalPurchasePaid), `${data.kpis.fullyPaidPurchasesCount} Purchases Fully Settled`, 'Supplier Flow'],
      ['Supplier Outstanding', formatPdfCurrency(data.kpis.totalPurchasePending), `${data.kpis.pendingPurchasesCount} Purchases Pending Settlement`, 'Supplier Flow'],
      ['Total Suppliers', String(data.kpis.totalSuppliers), `${data.kpis.activeSuppliers} Active Fleet Suppliers · Ledger Due: ${formatPdfCurrency(data.kpis.totalSupplierOutstanding)}`, 'Suppliers'],
    ],
    theme: 'striped',
    headStyles: {
      font: 'Roboto',
      fillColor: primaryBlue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    styles: {
      font: 'Roboto',
      fontSize: 7.5,
      textColor: darkSlate,
      cellPadding: 2,
      lineColor: borderGray,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 26 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ─────────────────────────────────────────────────────────────────────────
  // 4. FINANCIAL FLOW RECONCILIATION
  // ─────────────────────────────────────────────────────────────────────────
  currentY = drawSectionHeading('2. Order Financial Reconciliation Flow', currentY);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Component', 'Amount', 'Percentage', 'Accounting Reconciliation']],
    body: [
      ['Total Order Amount (Gross)', formatPdfCurrency(data.kpis.totalOrderAmount), '100.0%', 'Gross revenue of all orders in period'],
      ['Amount Collected (Receipts)', formatPdfCurrency(data.kpis.paidOrderAmount), data.kpis.totalOrderAmount > 0 ? `${((data.kpis.paidOrderAmount / data.kpis.totalOrderAmount) * 100).toFixed(1)}%` : '0.0%', 'Verified payments recorded'],
      ['Pending / Due Balance', formatPdfCurrency(data.kpis.pendingOrderAmount), data.kpis.totalOrderAmount > 0 ? `${((data.kpis.pendingOrderAmount / data.kpis.totalOrderAmount) * 100).toFixed(1)}%` : '0.0%', 'Outstanding customer balance (Verified: Collected + Due = Total)'],
    ],
    theme: 'grid',
    headStyles: {
      font: 'Roboto',
      fillColor: [30, 41, 59], // Darker slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    styles: {
      font: 'Roboto',
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: borderGray,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 48 },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 34 },
      2: { halign: 'center', cellWidth: 24 },
      3: { cellWidth: 'auto' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ─────────────────────────────────────────────────────────────────────────
  // 5. KEY PERFORMANCE INSIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  if (data.insights.length > 0) {
    currentY = drawSectionHeading('3. Key Business & Performance Insights', currentY);

    const cleanMonetaryStr = (str: string | undefined): string => {
      if (!str) return '—';
      return str.replace(/₹\s*['’`]/g, '₹').replace(/['’`]\s*₹/g, '₹');
    };

    const insightRows = data.insights.map((ins) => [
      ins.title,
      ins.entityName,
      cleanMonetaryStr(ins.value),
      cleanMonetaryStr(ins.subtext),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Insight Category', 'Top Entity / Customer / Supplier', 'Performance Highlight', 'Context']],
      body: insightRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: primaryBlue,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2,
      },
      styles: {
      font: 'Roboto',
        fontSize: 7.5,
        textColor: darkSlate,
        cellPadding: 2,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 46 },
        1: { fontStyle: 'bold', cellWidth: 44 },
        2: { fontStyle: 'bold', halign: 'right', cellWidth: 32 },
        3: { cellWidth: 'auto' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DAILY TRANSACTION TREND (Order vs Purchase activity)
  // ─────────────────────────────────────────────────────────────────────────
  const hasDaily = data.dailyData.orderDailyData.some((d) => d.primaryValue > 0) ||
    data.dailyData.purchaseDailyData.some((d) => d.primaryValue > 0);

  if (hasDaily) {
    currentY = drawSectionHeading('4. Daily Financial Trends', currentY);

    const dailyRows: any[] = [];
    const maxIdx = Math.max(data.dailyData.orderDailyData.length, data.dailyData.purchaseDailyData.length);

    for (let i = 0; i < maxIdx; i++) {
      const o = data.dailyData.orderDailyData[i];
      const p = data.dailyData.purchaseDailyData[i];
      const dateLabel = o?.label || p?.label || `Day ${i + 1}`;

      const oAmount = o?.primaryValue || 0;
      const oPaid = o?.secondaryValue || 0;
      const oDue = Math.max(0, oAmount - oPaid);
      const pAmount = p?.primaryValue || 0;
      const pPaid = p?.secondaryValue || 0;

      // Only include active days or summarize
      dailyRows.push([
        dateLabel,
        o?.meta?.count || 0,
        formatPdfCurrency(oAmount),
        formatPdfCurrency(oPaid),
        formatPdfCurrency(oDue),
        p?.meta?.count || 0,
        formatPdfCurrency(pAmount),
        formatPdfCurrency(pPaid),
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Date', 'Orders', 'Order Revenue', 'Collected', 'Order Due', 'Purchases', 'Purchase Spend', 'Supplier Paid']],
      body: dailyRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: primaryBlue,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 1.8,
        halign: 'center',
      },
      styles: {
      font: 'Roboto',
        fontSize: 7,
        textColor: darkSlate,
        cellPadding: 1.5,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 22 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'right', cellWidth: 28 },
        7: { halign: 'right', cellWidth: 28 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CUSTOMER PERFORMANCE MATRIX (Customers active in selected period)
  // ─────────────────────────────────────────────────────────────────────────
  if (data.customers.length > 0) {
    currentY = drawSectionHeading(`5. Customer Sales & Collection Matrix (${data.customers.length} Customers)`, currentY);

    const customerRows = data.customers.map((c) => [
      c.customerName,
      c.companyName || c.phone || '—',
      c.orderCount,
      formatPdfCurrency(c.totalAmount),
      formatPdfCurrency(c.paidAmount),
      formatPdfCurrency(c.dueAmount),
      formatPdfCurrency(c.averageOrderValue),
      formatPdfDate(c.lastOrderDate),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Customer', 'Contact / Company', 'Orders', 'Total Spend', 'Collected', 'Pending Due', 'Avg Order Value', 'Last Order']],
      body: customerRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      styles: {
      font: 'Roboto',
        fontSize: 7,
        textColor: darkSlate,
        cellPadding: 1.8,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 28 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 18 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. SUPPLIER PERFORMANCE & OUTSTANDING MATRIX
  // ─────────────────────────────────────────────────────────────────────────
  if (data.suppliers.length > 0) {
    currentY = drawSectionHeading(`6. Supplier Procurement & Outstanding Matrix (${data.suppliers.length} Suppliers)`, currentY);

    const supplierRows = data.suppliers.map((s) => [
      s.name + (s.companyName ? ` (${s.companyName})` : ''),
      s.purchasesInRange,
      formatPdfCurrency(s.totalInRange),
      formatPdfCurrency(s.paidInRange),
      formatPdfCurrency(s.pendingInRange),
      formatPdfCurrency(Math.abs(s.balance)) + (s.balance > 0 ? ' (Due)' : s.balance < 0 ? ' (Cr)' : ''),
      formatPdfDate(s.lastPurchasedAt),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Supplier Name', 'Purchases in Period', 'Purchased in Period', 'Paid in Period', 'Period Pending', 'Total Ledger Balance', 'Last Purchase']],
      body: supplierRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: primaryBlue,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      styles: {
      font: 'Roboto',
        fontSize: 7,
        textColor: darkSlate,
        cellPadding: 1.8,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 44 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        6: { halign: 'center', cellWidth: 18 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. DETAILED ORDERS LIST (Full data in selected period)
  // ─────────────────────────────────────────────────────────────────────────
  if (data.orders.length > 0) {
    currentY = drawSectionHeading(`7. Detailed Order Records (${data.orders.length} Orders in Period)`, currentY);

    const orderRows = data.orders.map((o) => [
      '#' + (o.id.length > 8 ? o.id.slice(-8).toUpperCase() : o.id.toUpperCase()),
      formatPdfDate(o.createdAt),
      o.customerName,
      o.itemsCount,
      formatPdfCurrency(o.totalAmount),
      formatPdfCurrency(o.amountPaid),
      formatPdfCurrency(o.amountDue),
      o.paymentStatus,
      o.status,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Order #', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Due', 'Payment', 'Order Status']],
      body: orderRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 1.8,
      },
      styles: {
      font: 'Roboto',
        fontSize: 6.5,
        textColor: darkSlate,
        cellPadding: 1.5,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 32 },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 18 },
        8: { halign: 'center', cellWidth: 18 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. DETAILED PURCHASES LIST (Full data in selected period)
  // ─────────────────────────────────────────────────────────────────────────
  if (data.purchases.length > 0) {
    currentY = drawSectionHeading(`8. Detailed Procurement Purchases (${data.purchases.length} Purchases in Period)`, currentY);

    const purchaseRows = data.purchases.map((p) => [
      p.purchaseNumber,
      formatPdfDate(p.purchaseDate),
      p.supplierName,
      p.itemsCount,
      formatPdfCurrency(p.subtotal),
      formatPdfCurrency(p.tax),
      formatPdfCurrency(p.total),
      formatPdfCurrency(p.amountPaid),
      formatPdfCurrency(p.pendingAmount),
      p.paymentStatus,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Purchase #', 'Date', 'Supplier', 'Items', 'Subtotal', 'Tax', 'Total', 'Paid', 'Pending', 'Status']],
      body: purchaseRows,
      theme: 'striped',
      headStyles: {
      font: 'Roboto',
        fillColor: primaryBlue,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 1.8,
      },
      styles: {
      font: 'Roboto',
        fontSize: 6.5,
        textColor: darkSlate,
        cellPadding: 1.5,
        lineColor: borderGray,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 32 },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 14 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', cellWidth: 18 },
        9: { halign: 'center', cellWidth: 16 },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. SUBTLE PROFESSIONAL FOOTER & ACCURATE PAGE NUMBERING (ALL PAGES)
  // ─────────────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider line
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    // Footer text
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);

    doc.text(
      `Edrops Distributor Portal · Confidential Business Report · Generated on ${nowFormatted}`,
      margin,
      pageHeight - 6.5
    );

    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. DIRECT DOWNLOAD (NO window.print(), NO dialogs)
  // ─────────────────────────────────────────────────────────────────────────
  const filename = `edrops-distributor-report-${isoDate}.pdf`;
  doc.save(filename);
}
