import {model, Schema} from 'mongoose'
import moment from 'moment-timezone'
import {v4 as uuidv4} from 'uuid'
const sessionSchema = new Schema({
    sessionID: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true
    },
    email: { type: String, required: true },
    nickname: { type: String, required: true },
    createdAt: {
      type: Date,
      default: () => moment().tz("America/Mexico_City").toDate(),
      required: true
    },
    lastAccess: {
      type: Date,
      default: () => moment().tz("America/Mexico_City").toDate(),
      required: true
    },
    status: {
      type: String,
      enum: ["Activa", "Inactiva", "Finalizada por el Usuario", "Finalizada por Error del Sistema"],
      default: "Activa",
      required: true
    },
    clientData: {
      ip: { type: String, required: true },
      macAddress: { type: String, required: true }
    },
    serverData: {
      ip: { type: String, required: true },
      macAddress: { type: String, required: true }
    },
    inactivityTime: {
      hours: { type: Number, default: 0, required: true, min: 0 },
      minutes: { type: Number, default: 0, required: true, min: 0, max: 59 },
      seconds: { type: Number, default: 0, required: true, min: 0, max: 59 }
    }
  },{
    versionKey:false,
    timestamps:true
  });
  
  export default model('Session', sessionSchema);