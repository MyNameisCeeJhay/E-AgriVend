import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
let transporter = null;

const initializeTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not configured. Email notifications disabled.');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    debug: true, // Enable debug logging
    logger: true
  });
};

// Initialize transporter
transporter = initializeTransporter();

// Verify connection if transporter exists
if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email service error:', error.message);
      console.error('   Please check your EMAIL_USER and EMAIL_PASS in .env');
    } else {
      console.log('✅ Email service ready to send emails');
      console.log(`   Using account: ${process.env.EMAIL_USER}`);
    }
  });
}

// Send refund status email
export const sendRefundStatusEmail = async (customerEmail, customerName, refundData, status, adminNotes) => {
  try {
    if (!transporter) {
      console.error('❌ Email service not initialized. Check EMAIL_USER and EMAIL_PASS');
      return { success: false, error: 'Email service not configured' };
    }
    
    if (!customerEmail) {
      console.error('❌ No customer email provided');
      return { success: false, error: 'No customer email' };
    }
    
    const isApproved = status === 'APPROVED';
    const statusText = isApproved ? 'APPROVED' : 'REJECTED';
    const statusColor = isApproved ? '#2d6a4f' : '#dc3545';
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Request ${statusText}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 3px solid ${statusColor};
            margin-bottom: 20px;
          }
          .header h1 {
            color: ${statusColor};
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 10px 0 0;
          }
          .content {
            padding: 20px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .status-card {
            background-color: ${isApproved ? '#d4edda' : '#f8d7da'};
            border-left: 4px solid ${statusColor};
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .status-card h3 {
            margin: 0 0 10px 0;
            color: ${statusColor};
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .details-table td {
            padding: 10px;
            border-bottom: 1px solid #eee;
          }
          .details-table td.label {
            font-weight: bold;
            width: 40%;
            background-color: #f9f9f9;
          }
          .details-table td.value {
            width: 60%;
          }
          .admin-notes {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .admin-notes h4 {
            margin: 0 0 10px 0;
            color: #555;
          }
          .admin-notes p {
            margin: 0;
            white-space: pre-wrap;
          }
          .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Request ${statusText}</h1>
            <p>AgriVend Smart Vending Machine</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${customerName},
            </div>
            
            <p>Your refund request (ID: <strong>${refundData.returnId}</strong>) has been <strong style="color: ${statusColor}">${statusText}</strong> by our administrator.</p>
            
            <div class="status-card">
              <h3>${isApproved ? '✅ Refund Approved' : '❌ Refund Rejected'}</h3>
              <p>${isApproved ? 'Your refund has been approved and will be processed shortly.' : 'We regret to inform you that your refund request has been rejected.'}</p>
            </div>
            
            <h3>📋 Refund Details</h3>
            <table class="details-table">
              <tr>
                <td class="label">Refund ID:</td>
                <td class="value">${refundData.returnId}</td>
              </tr>
              <tr>
                <td class="label">Transaction ID:</td>
                <td class="value">${refundData.transactionId}</td>
              </tr>
              <tr>
                <td class="label">Product:</td>
                <td class="value">${refundData.riceType}</td>
              </tr>
              <tr>
                <td class="label">Quantity:</td>
                <td class="value">${refundData.quantityKg} kg</td>
              </tr>
              <tr>
                <td class="label">Amount:</td>
                <td class="value">₱${refundData.amountPaid.toFixed(2)}</td>
              </tr>
              <tr>
                <td class="label">Processed On:</td>
                <td class="value">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            
            ${adminNotes ? `
            <div class="admin-notes">
              <h4>📝 Administrator's Notes:</h4>
              <p>${adminNotes}</p>
            </div>
            ` : ''}
            
            ${isApproved ? `
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #2d6a4f;">💰 What happens next?</h4>
              <p style="margin: 0;">Your refund will be processed within 3-5 business days. The amount will be credited back to your original payment method.</p>
            </div>
            ` : `
            <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #ff9800;">❓ Need assistance?</h4>
              <p style="margin: 0;">If you have questions about this decision, please contact our support team at support@agrivend.com with your refund ID.</p>
            </div>
            `}
          </div>
          
          <div class="footer">
            <p>This is an automated message from AgriVend. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} AgriVend. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Refund Request ${statusText} - ${refundData.returnId}`,
      html: emailHtml
    };
    
    console.log(`📧 Attempting to send ${status} email to ${customerEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ ${status} email sent successfully to ${customerEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending ${status} email:`, error.message);
    console.error('   Error details:', error);
    return { success: false, error: error.message };
  }
};

// Send confirmation email when refund request is submitted
export const sendRefundConfirmationEmail = async (customerEmail, customerName, refundData) => {
  try {
    if (!transporter) {
      console.error('❌ Email service not initialized. Check EMAIL_USER and EMAIL_PASS');
      return { success: false, error: 'Email service not configured' };
    }
    
    if (!customerEmail) {
      console.error('❌ No customer email provided');
      return { success: false, error: 'No customer email' };
    }
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Request Received</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 3px solid #ffc107;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #ffc107;
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 20px;
          }
          .success-badge {
            background-color: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Refund Request Received</h1>
            <p>AgriVend Smart Vending Machine</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${customerName},
            </div>
            
            <p>Thank you for submitting your refund request. We have received it and our team will review it shortly.</p>
            
            <div class="success-badge">
              <strong>✅ Request ID: ${refundData.returnId}</strong>
            </div>
            
            <h3>📋 Request Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Transaction ID:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${refundData.transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Product:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${refundData.riceType}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantity:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${refundData.quantityKg} kg</td>
              </tr>
              <tr>
                <td style="padding: 8px;"><strong>Amount:</strong></td>
                <td style="padding: 8px;">₱${refundData.amountPaid.toFixed(2)}</td>
              </tr>
            </table>
            
            <p style="margin-top: 20px;">We will notify you via email once your request has been processed (typically within 1-2 business days).</p>
            
            <p>You can check the status of your refund anytime using your Refund ID: <strong>${refundData.returnId}</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from AgriVend. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} AgriVend. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Refund Request Received - ${refundData.returnId}`,
      html: emailHtml
    };
    
    console.log(`📧 Attempting to send confirmation email to ${customerEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent successfully to ${customerEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending confirmation email:`, error.message);
    console.error('   Error details:', error);
    return { success: false, error: error.message };
  }
};

export default { sendRefundStatusEmail, sendRefundConfirmationEmail };