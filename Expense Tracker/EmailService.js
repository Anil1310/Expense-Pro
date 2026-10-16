/**
 * Automated Monthly Report Trigger
 * This can be set to run daily or monthly in Google Apps Script Triggers.
 */
function sendMonthlyReportAuto(customMonth, customEmail) {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = customMonth || months[now.getMonth()];
  const currentYear = now.getFullYear();

  const data = getMonthlyData(currentMonth);
  if (!data || data.tableData.length === 0) return { success: false, error: "No data found for " + currentMonth };

  const userName = "Expenses Pro";
  const targetEmail = customEmail || "anil.chahar170@gmail.com";
  const fileName = `Expense_Report_${currentMonth}_${currentYear}`;

  const summary = `📅 Month: ${currentMonth} ${currentYear}\n` +
    `💸 Total Expenses: ₹${data.totalExpenses}\n` +
    `📂 Categories: ${data.uniqueCategories}\n` +
    `📆 Active Days: ${data.daysWithExpenses}\n` +
    `👤 Status: Monthly Statement`;

  // Build the HTML for PDF (Backend version of the dashboard logic)
  const html = buildBackendReportHTML(data, currentMonth, currentYear, userName);

  return generateAndEmailPDF(html, fileName, targetEmail, summary);
}

/**
 * Builds the PDF HTML on the server side (for automation)
 */
function buildBackendReportHTML(data, month, year, userName) {
  const generatedAt = new Date().toLocaleString('en-IN');
  let tableRows = "";

  data.tableData.forEach((row, idx) => {
    const sn = row[0] || (idx + 1);
    const id = row[1] || '';
    const date = row[2] || '';
    const item = row[4] || '';
    const amount = row[5] || 0;
    const credit = row[6] || '';

    const isCredit = credit && credit.toString().trim() !== '';
    const creditTag = isCredit ? `<span style="display:inline-block;background:#dcfce7;color:#16a34a;border-radius:4px;font-size:0.7rem;padding:1px 6px;margin-left:4px;">✓ Credit</span>` : '';
    const rowBg = idx % 2 === 0 ? 'background:#f8fafc;' : '';

    tableRows += `
    <tr style="${rowBg}">
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">${sn}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#4f46e5;font-weight:500;">${id}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">${date}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${item}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:700;">₹${amount}${creditTag}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">${credit}</td>
    </tr>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica', Arial, sans-serif; color: #1e293b; font-size: 11px; }
  .page { padding: 40px; }
  .report-header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 25px; }
  .brand { font-size: 1.6rem; font-weight: 800; color: #4f46e5; }
  .stats-strip { display: flex; gap: 15px; margin-bottom: 25px; }
  .stat-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center; }
  .stat-box .label { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; }
  .stat-box .value { font-size: 1.3rem; font-weight: 800; color: #4f46e5; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #4f46e5; color: #fff; padding: 12px; text-align: left; white-space: nowrap; }
  tbody td { white-space: nowrap; }
  .footer { margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px; font-size: 0.7rem; color: #94a3b8; }
</style>
</head>
<body>
<div class="page">
  <div class="report-header">
    <div class="brand">💰 Expenses Pro</div>
    <div style="text-align:right">
      <div style="font-size:1.2rem;font-weight:800;">Monthly Report</div>
      <div style="color:#64748b;">${month} ${year} | Generated Auto</div>
    </div>
  </div>
  <div class="stats-strip">
    <div class="stat-box"><div class="label">Total</div><div class="value">₹${data.totalExpenses}</div></div>
    <div class="stat-box"><div class="label">Categories</div><div class="value">${data.uniqueCategories}</div></div>
    <div class="stat-box"><div class="label">Active Days</div><div class="value">${data.daysWithExpenses}</div></div>
  </div>
  <table>
    <thead><tr><th>S.N</th><th>ID</th><th>Date</th><th>Category</th><th>Amount</th><th>Remark</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Printed on: ${generatedAt} | Expenses Pro Automation</div>
</div>
</body>
</html>`;
}

/**
 * Generates a PDF from HTML and sends it via email.
 */
function generateAndEmailPDF(htmlContent, fileName, recipientEmail, summary) {
  const finalRecipient = recipientEmail || "anil.chahar170@gmail.com";

  try {
    const sanitizedHtml = `<html><body style="font-family: Arial, sans-serif;">${htmlContent}</body></html>`;

    const tempFile = DriveApp.createFile('temp_' + new Date().getTime() + '.html', sanitizedHtml, 'text/html');
    const pdfBlob = tempFile.getAs('application/pdf').setName(fileName + '.pdf');
    tempFile.setTrashed(true);

    // Create a professional HTML Body for the email
    const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #4f46e5; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: -1px; display: block;">Expenses Pro</h1>
        <p style="color: #c7d2fe; margin: 5px 0 0; font-size: 14px;">Automated Financial Reporting</p>
      </div>
      
      <div style="padding: 30px; color: #1e293b;">
        <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Monthly Report Ready</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">Hello Admin,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">The expense report for <strong>${fileName.replace('Expense_Report_', '').replace(/_/g, ' ')}</strong> has been generated successfully. You can find the detailed PDF statement attached to this email.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Executive Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total Expenses:</td>
              <td style="padding: 8px 0; text-align: right; color: #4f46e5; font-weight: 800; font-size: 16px;">${summary.match(/Total Expenses: (.*)/) ? summary.match(/Total Expenses: (.*)/)[1] : 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Active Categories:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${summary.match(/Categories: (.*)/) ? summary.match(/Categories: (.*)/)[1] : 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Active Days:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${summary.match(/Active Days: (.*)/) ? summary.match(/Active Days: (.*)/)[1] : 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 13px; color: #94a3b8; font-style: italic;">Note: This is an automated email. Please do not reply directly to this message.</p>
      </div>
      
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600;">Expenses Pro - 2026</p>
        <p style="margin: 5px 0 0; font-size: 11px; color: #94a3b8;">High-Precision Finance Tracking</p>
      </div>
    </div>`;

    const options = {
      htmlBody: htmlBody,
      attachments: [pdfBlob],
      name: "Expenses Pro Automation"
    };

    GmailApp.sendEmail(finalRecipient, "Expense Report: " + fileName, "", options);

    return { success: true };
  } catch (e) {
    console.error("Critical PDF/Email Error:", e.message);
    return { error: e.message };
  }
}

/**
 * Run this function manually in the Apps Script Editor (script.google.com)
 * to trigger the Google OAuth Authorization dialog for Gmail.
 */
function triggerGmailPermissionCheck() {
  GmailApp.sendEmail("anil.chahar170@gmail.com", "Expenses Pro Scope Authorization", "Gmail permissions authorized successfully!");
}
