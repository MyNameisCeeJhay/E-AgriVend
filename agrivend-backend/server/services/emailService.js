import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n📧 Email Configuration Check:');
console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || 'NOT SET'}`);
console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✓ SET (length: ' + process.env.EMAIL_PASS.length + ')' : 'NOT SET'}`);

// Create transporter with working configuration
let transporter = null;

try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // These options help with delivery
    tls: {
      rejectUnauthorized: false
    },
    debug: true,
    logger: true
  });
  
  console.log('✅ Transporter created successfully');
} catch (error) {
  console.error('❌ Failed to create transporter:', error.message);
}

// Verify connection immediately
if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email verification failed:', error.message);
      console.error('   Please check your Gmail App Password');
    } else {
      console.log('✅ Email service is ready to send emails!');
      console.log(`   Account: ${process.env.EMAIL_USER}`);
    }
  });
}

// Send refund status email - Direct and simple
export const sendRefundStatusEmail = async (customerEmail, customerName, refundData, status, adminNotes) => {
  console.log(`\n📧 ===== SENDING ${status} REFUND EMAIL =====`);
  console.log(`   Customer: ${customerName}`);
  console.log(`   Email: ${customerEmail}`);
  console.log(`   Refund ID: ${refundData.returnId}`);
  
  if (!customerEmail) {
    console.error('❌ No email address provided');
    return { success: false, error: 'No email address' };
  }
  
  if (!transporter) {
    console.error('❌ Email transporter not initialized');
    return { success: false, error: 'Email service not configured' };
  }
  
  const isApproved = status === 'APPROVED';
  const statusText = isApproved ? 'APPROVED' : 'REJECTED';
  
  // Simple HTML email that will definitely work
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <div style="background: ${isApproved ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
        <h1 style="margin: 0;">Refund ${statusText}</h1>
      </div>
      
      <p>Dear <strong>${customerName}</strong>,</p>
      
      <p>Your refund request has been <strong>${statusText}</strong>.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Refund Details:</h3>
        <p><strong>Refund ID:</strong> ${refundData.returnId}</p>
        <p><strong>Transaction ID:</strong> ${refundData.transactionId}</p>
        <p><strong>Product:</strong> ${refundData.riceType}</p>
        <p><strong>Quantity:</strong> ${refundData.quantityKg} kg</p>
        <p><strong>Amount:</strong> ₱${refundData.amountPaid.toFixed(2)}</p>
      </div>
      
      ${adminNotes ? `<p><strong>Admin Note:</strong> ${adminNotes}</p>` : ''}
      
      <p>${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact our support team.'}</p>
      
      <p>Thank you for choosing AgriVend.</p>
      
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      
      <p style="color: #999; font-size: 12px;">This is an automated message from AgriVend. Please do not reply to this email.</p>
    </div>
  `;
  
  const textContent = `
Refund ${statusText}
Dear ${customerName},

Your refund request has been ${statusText}.

Refund Details:
Refund ID: ${refundData.returnId}
Transaction ID: ${refundData.transactionId}
Product: ${refundData.riceType}
Quantity: ${refundData.quantityKg} kg
Amount: ₱${refundData.amountPaid.toFixed(2)}

${adminNotes ? `Admin Note: ${adminNotes}\n` : ''}
${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact support.'}

Thank you for choosing AgriVend.
  `;
  
  try {
    const mailOptions = {
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Refund ${statusText} - ${refundData.returnId}`,
      html: htmlContent,
      text: textContent
    };
    
    console.log('📧 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email:`, error.message);
    console.error(`   Error code:`, error.code);
    console.error(`   Command:`, error.command);
    return { success: false, error: error.message };
  }
};

// Send confirmation email
export const sendRefundConfirmationEmail = async (customerEmail, customerName, refundData) => {
  console.log(`\n📧 ===== SENDING CONFIRMATION EMAIL =====`);
  console.log(`   Customer: ${customerName}`);
  console.log(`   Email: ${customerEmail}`);
  console.log(`   Refund ID: ${refundData.returnId}`);
  
  if (!customerEmail) {
    console.error('❌ No email address provided');
    return { success: false, error: 'No email address' };
  }
  
  if (!transporter) {
    console.error('❌ Email transporter not initialized');
    return { success: false, error: 'Email service not configured' };
  }
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <div style="background: #FFC107; color: #333; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
        <h1 style="margin: 0;">Refund Request Received</h1>
      </div>
      
      <p>Dear <strong>${customerName}</strong>,</p>
      
      <p>Thank you for submitting your refund request. We have received it and will review it shortly.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Request Details:</h3>
        <p><strong>Refund ID:</strong> ${refundData.returnId}</p>
        <p><strong>Transaction ID:</strong> ${refundData.transactionId}</p>
        <p><strong>Product:</strong> ${refundData.riceType}</p>
        <p><strong>Quantity:</strong> ${refundData.quantityKg} kg</p>
        <p><strong>Amount:</strong> ₱${refundData.amountPaid.toFixed(2)}</p>
      </div>
      
      <p>We will notify you once your request has been processed (typically within 1-2 business days).</p>
      
      <p>Thank you for your patience.</p>
      
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      
      <p style="color: #999; font-size: 12px;">This is an automated message from AgriVend. Please do not reply to this email.</p>
    </div>
  `;
  
  const textContent = `
Refund Request Received

Dear ${customerName},

Thank you for submitting your refund request.

Request Details:
Refund ID: ${refundData.returnId}
Transaction ID: ${refundData.transactionId}
Product: ${refundData.riceType}
Quantity: ${refundData.quantityKg} kg
Amount: ₱${refundData.amountPaid.toFixed(2)}

We will notify you once your request has been processed.

Thank you for your patience.
  `;
  
  try {
    const mailOptions = {
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Refund Request Received - ${refundData.returnId}`,
      html: htmlContent,
      text: textContent
    };
    
    console.log('📧 Sending confirmation email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent!`);
    console.log(`   Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send confirmation:`, error.message);
    return { success: false, error: error.message };
  }
};

export default { sendRefundStatusEmail, sendRefundConfirmationEmail };