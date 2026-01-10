import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * PDF Report Generator for PayReconcile
 */
export const generateTransactionsPDF = (transactions, title = 'Transactions Report') => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(37, 99, 235); // Primary blue
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('PayReconcile', 14, 18);
  doc.setFontSize(12);
  doc.text(title, 14, 26);
  
  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 18);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Summary stats
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
  const failedCount = transactions.filter(t => t.status === 'FAILED').length;
  
  doc.setFontSize(11);
  doc.text(`Total Transactions: ${transactions.length}`, 14, 42);
  doc.text(`Total Amount: INR ${totalAmount.toLocaleString()}`, 14, 48);
  doc.text(`Success: ${successCount} | Failed: ${failedCount}`, 14, 54);
  
  // Table
  const tableData = transactions.map(t => [
    t.transaction_id || '-',
    t.merchant_id || '-',
    `${t.currency || 'INR'} ${(t.amount || 0).toLocaleString()}`,
    t.status || '-',
    t.reconciliation_status?.replace(/_/g, ' ') || '-',
    new Date(t.transaction_date).toLocaleDateString()
  ]);
  
  doc.autoTable({
    startY: 62,
    head: [['Transaction ID', 'Merchant', 'Amount', 'Status', 'Reconciliation', 'Date']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22 },
      4: { cellWidth: 35 },
      5: { cellWidth: 25 }
    }
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${pageCount}`, 100, 290, { align: 'center' });
    doc.text('PayReconcile - Payment Settlement Platform', 14, 290);
  }
  
  doc.save(`transactions_report_${Date.now()}.pdf`);
};

export const generateReconciliationPDF = (matchedCount, unmatchedCount, mismatchCount, details = []) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(16, 185, 129); // Emerald
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('PayReconcile', 14, 18);
  doc.setFontSize(12);
  doc.text('Reconciliation Report', 14, 26);
  
  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 18);
  
  // Reset
  doc.setTextColor(0, 0, 0);
  
  // Summary boxes
  const total = matchedCount + unmatchedCount + mismatchCount;
  const matchRate = total > 0 ? ((matchedCount / total) * 100).toFixed(1) : 0;
  
  doc.setFontSize(14);
  doc.text('Summary', 14, 42);
  
  doc.setFontSize(11);
  doc.setDrawColor(200, 200, 200);
  
  // Matched box
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(14, 48, 55, 25, 3, 3, 'FD');
  doc.setTextColor(5, 150, 105);
  doc.text('Matched', 20, 58);
  doc.setFontSize(16);
  doc.text(matchedCount.toString(), 20, 68);
  
  // Unmatched box
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(77, 48, 55, 25, 3, 3, 'FD');
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(11);
  doc.text('Unmatched', 83, 58);
  doc.setFontSize(16);
  doc.text(unmatchedCount.toString(), 83, 68);
  
  // Mismatch box
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(140, 48, 55, 25, 3, 3, 'FD');
  doc.setTextColor(217, 119, 6);
  doc.setFontSize(11);
  doc.text('Mismatch', 146, 58);
  doc.setFontSize(16);
  doc.text(mismatchCount.toString(), 146, 68);
  
  // Match rate
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Match Rate: ${matchRate}%`, 14, 85);
  
  // Details table if provided
  if (details.length > 0) {
    const tableData = details.slice(0, 50).map(d => [
      d.transaction_id || '-',
      d.merchant_id || '-',
      d.status || '-',
      d.reconciliation_status?.replace(/_/g, ' ') || '-',
      d.discrepancy || '-'
    ]);
    
    doc.autoTable({
      startY: 95,
      head: [['Transaction ID', 'Merchant', 'Status', 'Reconciliation', 'Issue']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
      bodyStyles: { fontSize: 8 }
    });
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('PayReconcile - Payment Settlement Platform', 14, 290);
  
  doc.save(`reconciliation_report_${Date.now()}.pdf`);
};

export const generateMerchantReportPDF = (merchants, title = 'Merchant Performance Report') => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(124, 58, 237); // Purple
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('PayReconcile', 14, 18);
  doc.setFontSize(12);
  doc.text(title, 14, 26);
  
  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 18);
  
  // Reset
  doc.setTextColor(0, 0, 0);
  
  // Summary
  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter(m => m.status === 'ACTIVE').length;
  
  doc.setFontSize(11);
  doc.text(`Total Merchants: ${totalMerchants}`, 14, 42);
  doc.text(`Active: ${activeMerchants}`, 14, 48);
  
  // Table
  const tableData = merchants.map(m => [
    m.merchant_id || '-',
    m.name || '-',
    m.status || '-',
    m.settlement_cycle || '-',
    (m.volume || 0).toLocaleString(),
    (m.successRate || 0).toFixed(1) + '%'
  ]);
  
  doc.autoTable({
    startY: 56,
    head: [['Merchant ID', 'Name', 'Status', 'Cycle', 'Volume', 'Success Rate']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
    bodyStyles: { fontSize: 8 }
  });
  
  doc.save(`merchant_report_${Date.now()}.pdf`);
};
