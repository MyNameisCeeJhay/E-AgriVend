import mongoose from 'mongoose';

const termsAgreementSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const TermsAgreement = mongoose.model('TermsAgreement', termsAgreementSchema);
export default TermsAgreement;