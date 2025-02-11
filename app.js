import Session from "./models/Session.js";
import express from 'express'
import mongoose from "mongoose";
import session from 'express-session'
import moment from 'moment-timezone'
import os from 'os'

mongoose.connect('mongodb+srv://230052:Taco1995@hadrycluster.lbdby.mongodb.net/API-AWI4_0-230052?retryWrites=true&w=majority').then((db)=>console.log('MongoDB atlas connected 🌱'))
const app = express();
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.listen(3000,()=>{
    console.log("Server running on port: 3000✅")
})

const sessions = {}
const getServerNetworkInfo = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces){
        for (const iface of interfaces[name]){
            if (iface.family === 'IPv4' && !iface.internal){
                return {
                    serverIp: iface.address,
                    serverMac: iface.mac
                }
            }
        }
    }
}

app.use(session({
    secret:"P6-APJ#PixelG7Hadry-VariablesdeSesión",
    resave:false,
    saveUninitialized:false,
    cookie:{maxAge:5*60*1000}
}))

const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // IPv4 y no interna (no localhost)
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null; // Retorna null si no encuentra una IP válida
};
const getClientIp = (req) => {
    let ip = req.header("x-forwarded-for") || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;
    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }
    return ip;
};

const getServerMacAddress = () => {
    const networkInterfaces = os.networkInterfaces();
    for (let interfaceName in networkInterfaces) {
        const interfaceInfo = networkInterfaces[interfaceName];
        for (let i = 0; i < interfaceInfo.length; i++) {
            const address = interfaceInfo[i];
            if (address.family === 'IPv4' && !address.internal) {
                return address.mac;
            }
        }
    }
    return null;
};

const auth = async (req, res, next) => {
    const sessionId = req.query.sessionId || req.body.sessionId;
    try {
        const session = await Session.findOne({ sessionID: sessionId });
        if (!session) {
            return res.status(401).json({ message: "Sesión no válida" });
        }
        const ahora = moment();
        const ultimoAcceso = moment(session.lastAccess);
        const diferencia = ahora.diff(ultimoAcceso, "seconds");
        session.inactivityTime = {
            hours: Math.floor(diferencia / 3600),
            minutes: Math.floor((diferencia % 3600) / 60),
            seconds: diferencia % 60,
        };
        
        if (diferencia >= 30 && session.status === "Activa") {
            session.status = "Inactiva"; // Cambia a inactiva después de 1 minuto
        }
        await session.save();
        
        if (diferencia >= 120) {
            session.status = "Finalizada por Error del Sistema";
        }
        
        await session.save();
        next();
    } catch (error) {
        res.status(500).json({ message: "Error de autenticación", error: error.message });
    }
};

app.get('/',(req,res)=>{
    return res.status(200).json({
        message:"Bienvenid@ al API de control de sesiones",
        author: "Adrián Pérez Jiménez",
    })
})

app.post("/login", async (req, res) => {
    const { email, nickname, macAddress } = req.body;
    
    try {
        const serverMac = getServerMacAddress();
        const serverIp = getLocalIp();

        const newSession = await Session.create({
            email,
            nickname,
            clientData: {
                ip: getClientIp(req),
                macAddress
            },
            serverData: {
                ip: serverIp,
                macAddress: serverMac
            },
            status: "Activa",
            inactivityTime: { hours: 0, minutes: 0, seconds: 0 }, // Inicializar a 0
            createdAt: moment().tz("America/Mexico_City").toDate(), // <-- Fecha en CDMX
            lastAccess: moment().tz("America/Mexico_City").toDate() // <-- Fecha en CDMX
        });

        res.status(201).json({
            message: "Sesión creada exitosamente",
            sessionId: newSession.sessionID
        });

    } catch (error) {
        res.status(500).json({ message: "Error al crear sesión", error: error.message });
    }
});
//Logout endpoint
app.post("/logout", async (req, res) => {
    const { sessionId } = req.body;
    try {
        const session = await Session.findOneAndUpdate(
            { sessionID: sessionId },
            {
            $set: {
                status: "Finalizada por el Usuario",
                lastAccess: moment().tz("America/Mexico_City").toDate(),
            },
            },
            { new: true }
        );

    if(!session) {
        return res.status(404).json({ message: "Sesión no encontrada" });
    }

        res.status(200).json({ message: "Sesión finalizada exitosamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al cerrar sesión", error: error.message });
    }
});
    
app.put("/update", auth, async (req, res) => {
const { sessionId, email, nickname } = req.body;
    try {
        const updatedSession = await Session.findOneAndUpdate(
            { sessionID: sessionId },
            {
                $set: {
                    email,
                    nickname,
                    lastAccess: moment().tz("America/Mexico_City").toDate(),
                    inactivityTime: { hours: 0, minutes: 0, seconds: 0 },
                },
            },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(404).json({ message: "Sesión no encontrada" });
        }

        res.status(200).json({
            message: "Sesión actualizada",
            session: updatedSession,
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar sesión", error: error.message });
    }
});

app.get("/status", auth, async (req, res) => {
    const { sessionId } = req.query;
    try {
        const session = await Session.findOne({ sessionID: sessionId });
        if (!session) {
            return res.status(404).json({ message: "Sesión no encontrada" });
        }
        const formattedSession = {
            ...session.toObject(),
            createdAt: moment(session.createdAt).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss"),
            lastAccess: moment(session.lastAccess).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss")
        };
        res.status(200).json({
            message: "Sesión activa",
            session: formattedSession
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener sesión", error: error.message });
    }
});


app.get("/sessions", async (req, res) => {
    try {
        const allSessions = await Session.find({});
        const ahora = moment();
        
        for (const session of allSessions) {
            const ultimoAcceso = moment(session.lastAccess);
            const diferencia = ahora.diff(ultimoAcceso, "seconds");
            
            session.inactivityTime = {
                hours: Math.floor(diferencia / 3600),
                minutes: Math.floor((diferencia % 3600) / 60),
                seconds: diferencia % 60,
            };
            
            if (diferencia >= 30 && session.status === "Activa") {
                session.status = "Inactiva";
            }
            await session.save();
            
            if (diferencia >= 120) {
                session.status = "Finalizada por Error del Sistema";
            }
            await session.save();
        }
        
        const updatedSessions = await Session.find({});
        res.status(200).json({
            message: "Lista de sesiones actualizadas",
            sessions: updatedSessions
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener sesiones", error: error.message });
    }
});


app.get("/allCurrentSessions", async (req, res) => {
    try {
        const activeSessions = await Session.find({ status: { $in: ["Activa", "Inactiva"] } });
        const ahora = moment();
        
        for (const session of activeSessions) {
            const ultimoAcceso = moment(session.lastAccess);
            const diferencia = ahora.diff(ultimoAcceso, "seconds");
            
            session.inactivityTime = {
                hours: Math.floor(diferencia / 3600),
                minutes: Math.floor((diferencia % 3600) / 60),
                seconds: diferencia % 60,
            };
            
            if (diferencia >= 30 && session.status === "Activa") {
                session.status = "Inactiva";
            }
            await session.save();
            
            if (diferencia >= 120) {
                session.status = "Finalizada por Error del Sistema";
            }
            await session.save();
        }
        
        const updatedActiveSessions = await Session.find({ status: { $in: ["Activa", "Inactiva"] } });
        res.status(200).json({
            message: "Lista de sesiones activas e inactivas actualizadas",
            sessions: updatedActiveSessions
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener sesiones activas", error: error.message });
    }
});

app.delete('/deleteAllSessions', async (req, res) => {
    try {
          await Session.deleteMany({});
          res.status(200).json({ message: "Todas las sesiones han sido eliminadas." });
    }catch (error) {
          res.status(500).json({ 
            message: "Error al eliminar las sesiones!", 
            error: error.message 
          });
      }
  });