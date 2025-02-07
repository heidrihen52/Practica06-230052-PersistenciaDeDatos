import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionID: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  nickname: {
    type: String,
    required: true
  },
  macAddress: {
    type: String,
    required: true
  },
  createdAt: {
    type: String,
    required: true
  },
  lastAccessed: {
    type: String,
    required: true
  },
  serverIp: {
    type: String,
    required: true
  },
  serverMac: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["Activa", "Inactiva", "Finalizada por el Usuario", "Finalizada por Falla de Sistema"],
    default: "Activa"
  }
} ,{ versionKey: false });

export default mongoose.model('Session', sessionSchema);
