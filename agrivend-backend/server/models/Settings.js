// models/Settings.js
import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  dinoradoPrice: { type: Number, default: 65.0 },
  sinandomengPrice: { type: Number, default: 52.0 },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: String, default: 'system'
  }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;