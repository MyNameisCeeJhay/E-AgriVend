import TermsAgreement from '../models/TermsAgreement.js';
import User from '../models/User.js';

// @desc    Get current terms
// @route   GET /api/terms/current
// @access  Public
export const getCurrentTerms = async (req, res) => {
  try {
    let terms = await TermsAgreement.findOne({ isActive: true })
      .sort({ effectiveDate: -1 });

    if (!terms) {
      // Create default terms
      terms = await TermsAgreement.create({
        version: '1.0',
        content: `BY USING AGRIVEND SERVICES, YOU AGREE TO THE FOLLOWING TERMS AND CONDITIONS:

1. ACCEPTANCE OF TERMS
By accessing and using the AgriVend rice vending machine and associated services, you accept and agree to be bound by these Terms and Conditions.

2. MACHINE USAGE
- The vending machine accepts both coins and bills as payment.
- All transactions are final unless there is a machine malfunction.
- The machine dispenses rice based on the exact value of payment inserted.
- Maximum transaction limit is 5kg per customer.

3. RETURNS AND REFUNDS
- Returns are accepted only for machine malfunctions or incorrect dispensing.
- Return requests must be submitted within 24 hours of purchase.
- Valid receipt or proof of purchase is required for all returns.
- Refunds will be processed within 3-5 business days upon approval.

4. USER ACCOUNTS
- You are responsible for maintaining the confidentiality of your account.
- You must provide accurate and complete information when registering.
- We reserve the right to suspend or terminate accounts for violations.

5. PRIVACY POLICY
- We collect personal information necessary for transaction processing.
- Your data will not be shared with third parties without consent.
- Transaction records are stored for reporting and analysis purposes.

6. LIMITATION OF LIABILITY
- AgriVend is not liable for any indirect or consequential damages.
- Our maximum liability shall not exceed the amount paid for the product.

7. CHANGES TO TERMS
- We reserve the right to modify these terms at any time.
- Continued use of the service constitutes acceptance of new terms.

8. CONTACT INFORMATION
For questions or concerns, please contact:
Email: support@agrivend.com
Store: GC Rice & Trading Store, Loma De Gato, Marilao, Bulacan

Last updated: ${new Date().toLocaleDateString()}`
      });
    }

    res.json({
      success: true,
      terms
    });

  } catch (error) {
    console.error('Get Terms Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Accept terms
// @route   POST /api/terms/accept
// @access  Private
export const acceptTerms = async (req, res) => {
  try {
    const { termsId } = req.body;

    const terms = await TermsAgreement.findById(termsId);
    if (!terms) {
      return res.status(404).json({ 
        success: false,
        error: 'Terms not found' 
      });
    }

    const user = await User.findById(req.user._id);
    user.termsAccepted = true;
    user.termsAcceptedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Terms accepted successfully',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Accept Terms Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};