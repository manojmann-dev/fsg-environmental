import PDFDocument from 'pdfkit';
export function buildBusinessPdf(docData, settings = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
    const green = '#0e2118'; const lime = '#51d64b';
    pdf.rect(0, 0, 595, 118).fill(green);
    pdf.fillColor('#fff').fontSize(19).font('Helvetica-Bold').text(settings.companyName || 'FSG ENVIRONMENTAL', 48, 34);
    pdf.fontSize(8).font('Helvetica').text(settings.address || '', 48, 64, { width: 290 });
    pdf.fontSize(22).font('Helvetica-Bold').text(docData.type === 'invoice' ? 'INVOICE' : 'QUOTATION', 380, 40, { align: 'right' });
    pdf.fillColor('#17211a').fontSize(10).font('Helvetica-Bold').text(`Number: ${docData.number}`, 48, 145);
    pdf.font('Helvetica').text(`Date: ${new Date(docData.createdAt || Date.now()).toLocaleDateString('en-GB')}`, 48, 161);
    pdf.font('Helvetica-Bold').text('Prepared for', 340, 145); pdf.font('Helvetica').text(`${docData.customer?.name || ''}\n${docData.customer?.company || ''}\n${docData.customer?.email || ''}\n${docData.customer?.address || ''}`, 340, 161, { width: 205 });
    let y = 250; pdf.rect(48, y, 499, 25).fill(lime); pdf.fillColor(green).font('Helvetica-Bold').fontSize(9);
    pdf.text('DESCRIPTION', 56, y + 8); pdf.text('QTY', 350, y + 8, { width: 45, align: 'right' }); pdf.text('UNIT PRICE', 400, y + 8, { width: 65, align: 'right' }); pdf.text('TOTAL', 472, y + 8, { width: 66, align: 'right' });
    y += 34; pdf.fillColor('#17211a').font('Helvetica').fontSize(9);
    for (const item of (docData.items || [])) { pdf.text(item.description || 'Service', 56, y, { width: 275 }); pdf.text(String(item.quantity ?? 1), 350, y, { width: 45, align: 'right' }); pdf.text(`${docData.currency || 'GBP'} ${(item.unitPrice || 0).toFixed(2)}`, 400, y, { width: 65, align: 'right' }); pdf.text(`${docData.currency || 'GBP'} ${(item.total || 0).toFixed(2)}`, 472, y, { width: 66, align: 'right' }); y += 26; pdf.moveTo(48, y - 7).lineTo(547, y - 7).strokeColor('#e3e9e2').stroke(); if (y > 650) { pdf.addPage(); y = 55; } }
    y += 12; const totals = [['Subtotal', docData.subtotal], [`Tax (${docData.taxRate || 0}%)`, docData.tax], ['Total', docData.total]];
    for (const [label, amount] of totals) { pdf.font(label === 'Total' ? 'Helvetica-Bold' : 'Helvetica').fontSize(label === 'Total' ? 13 : 10).text(label, 370, y, { width: 90, align: 'right' }).text(`${docData.currency || 'GBP'} ${(amount || 0).toFixed(2)}`, 465, y, { width: 82, align: 'right' }); y += label === 'Total' ? 27 : 19; }
    if (docData.notes) { y += 12; pdf.font('Helvetica-Bold').fontSize(10).text('Notes', 48, y); pdf.font('Helvetica').fontSize(9).text(docData.notes, 48, y + 16, { width: 490 }); }
    if (docData.terms) { y += 60; pdf.font('Helvetica-Bold').fontSize(10).text('Terms', 48, y); pdf.font('Helvetica').fontSize(9).text(docData.terms, 48, y + 16, { width: 490 }); }
    pdf.end();
  });
}
