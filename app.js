import Session from "./models/Session.js";
import express from 'express'
import mongoose from "mongoose";
import bodyParser from 'body-parser'
import {v4 as uuidv4} from 'uuid'
import session from 'express-session'
import moment from 'moment-timezone'
import os from 'os'
import cors from 'cors'
mongoose.connect('mongodb+srv://230052:Taco1995@hadrycluster.lbdby.mongodb.net/API-AWI4_0-230052?retryWrites=true&w=majority').then((db)=>console.log('MongoDB atlas connected'))
const app = express();
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(cors({
    origin:[
        ''
    ]
}))
app.listen(3000,()=>{
    console.log("Servidor corriendo en el puerto 3000")
})
// Configuración de las sesiones
app.use(session({
    secret:"P6-APJ#PixelG7Hadry-DatosDeSesionPersistentes-VariablesDeSesion",
    resave:false,
    saveUninitialized:false,
    cookie:{maxAge:5*60*1000}
}))
// Sesiones almacenadas en Memoria (RAM)
const sessions = {}
//Funcion que permite acceder a la información de la interfaz de red en este caso LAN
const getClientIp = (req) => {
    let ip = req.header("x-forwarded-for") || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;

    // Si la dirección es una IPv6 mapeada como IPv4, elimina el prefijo ::ffff:
    if (ip && ip.startsWith("::ffff:")) {
        ip = ip.substring(7); // Elimina el prefijo "::ffff:"
    }

    return ip;
};

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
// Funcion de utilidad que nos permitira acceder a la información de la interfaz de la red
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
const getServerMacAddress = () => {
    const networkInterfaces = os.networkInterfaces();
    for (let interfaceName in networkInterfaces) {
        const interfaceInfo = networkInterfaces[interfaceName];
        for (let i = 0; i < interfaceInfo.length; i++) {
            const address = interfaceInfo[i];
            if (address.family === 'IPv4' && !address.internal) {
                return address.mac;  // Retorna la dirección MAC de la interfaz de red
            }
        }
    }
    return null; // Si no se encuentra, devuelve null
};

const auth = async (req, res, next) => {
    const sessionId = req.query.sessionId || req.body.sessionId;
    
    try {
        const session = await Session.findOne({ sessionID: sessionId });
        
        if (!session) {
            return res.status(401).json({ message: "Sesión no válida" });
        }
        // Solo actualizar lastAccess si NO es el endpoint /status
        if (!req.originalUrl.includes("/status")) { // <-- Condición añadida
            session.lastAccess = moment().tz("America/Mexico_City").toDate();
            await session.save();
        }

        // Calcular inactividad
        const ahora = moment();
        const ultimoAcceso = moment(session.lastAccess);
        const diferencia = ahora.diff(ultimoAcceso, "seconds");

        // Actualizar tiempo de inactividad en la DB
        session.inactivityTime = {
            hours: Math.floor(diferencia / 3600),
            minutes: Math.floor((diferencia % 3600) / 60),
            seconds: diferencia % 60,
        };
        await session.save();

        // Verificar si supera 2 minutos (120 segundos)
        if (diferencia >= 120) {
            session.status = "Finalizada por Error del Sistema";
            await session.save();
            return res.status(401).json({ message: "Sesión cerrada por inactividad" });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Error de autenticación", error: error.message });
    }
};
app.get('/',(req,res)=>{
    return res.status(200).json({
        message:"Bienvenido al API de Control de Sesiones",
        author: "Adrian Perez Jimenez",
    })
})
// Login endpoint
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
                lastAccess: moment().tz("America/Mexico_City").toDate()
              } 
            },
            { new: true }
          );
      
          if (!session) {
            return res.status(404).json({ message: "Sesión no encontrada" });
          }
      
          res.status(200).json({ message: "Sesión finalizada exitosamente" });
      
        } catch (error) {
          res.status(500).json({ message: "Error al cerrar sesión", error: error.message });
        }
      });
    //Actualización de la Sesión
    app.put("/update", auth, async (req, res) => {
        const { sessionId, email, nickname } = req.body;
    
        try {
            const updatedSession = await Session.findOneAndUpdate(
                { sessionID: sessionId },
                {
                    $set: {
                        email,
                        nickname,
                        lastAccess: moment().tz("America/Mexico_City").toDate(), // Actualizar lastAccess
                        inactivityTime: { hours: 0, minutes: 0, seconds: 0 } // Reiniciar inactividad
                    }
                },
                { new: true }
            );
    
            if (!updatedSession) {
                return res.status(404).json({ message: "Sesión no encontrada" });
            }
    
            res.status(200).json({
                message: "Sesión actualizada",
                session: updatedSession
            });
    
        } catch (error) {
            res.status(500).json({ message: "Error al actualizar sesión", error: error.message });
        }
    });

    //Estatus
   app.get("/status", auth, async (req, res) => {
    const { sessionId } = req.query;

    try {
        const session = await Session.findOne({ sessionID: sessionId });
        
        if (!session) {
            return res.status(404).json({ message: "Sesión no encontrada" });
        }
        
        // No actualizamos lastAccess aquí
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

    // Endpoint para obtener la lista de sesiones activas
    app.get("/sessions", async (req, res) => {
        try {
            const allSessions = await Session.find({});
            const ahora = moment();
    
            // Actualizar inactividad y cerrar sesiones expiradas
            for (const session of allSessions) {
                const ultimoAcceso = moment(session.lastAccess);
                const diferencia = ahora.diff(ultimoAcceso, "seconds");
    
                // Actualizar inactividad
                session.inactivityTime = {
                    hours: Math.floor(diferencia / 3600),
                    minutes: Math.floor((diferencia % 3600) / 60),
                    seconds: diferencia % 60,
                };
    
                // Cerrar sesiones inactivas > 2 minutos
                if (diferencia >= 120 && session.status === "Activa") {
                    session.status = "Finalizada por Error del Sistema";
                }
    
                await session.save();
            }
    
            // Obtener sesiones actualizadas
            const updatedSessions = await Session.find({});
    
            // Formatear fechas correctamente para la zona horaria de Mexico
            const formattedSessions = updatedSessions.map(session => {
                return {
                    ...session.toObject(),
                    createdAt: moment(session.createdAt).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss"),
                    lastAccess: moment(session.lastAccess).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss")
                };
            });
    
            res.status(200).json({
                message: "Todas las sesiones",
                sessions: formattedSessions,
            });
    
        } catch (error) {
            res.status(500).json({ message: "Error al obtener sesiones", error: error.message });
        }
    });
    
    // Actualizar idle_activity para todas las sesiones
    app.get("/allCurrentSessions", async (req, res) => {
        try {
            const activeSessions = await Session.find({ status: "Activa" });
            const ahora = moment();
    
            // Actualizar inactividad en tiempo real
            for (const session of activeSessions) {
                const ultimoAcceso = moment(session.lastAccess);
                const diferencia = ahora.diff(ultimoAcceso, "seconds");
    
                // Actualizar inactividad
                session.inactivityTime = {
                    hours: Math.floor(diferencia / 3600),
                    minutes: Math.floor((diferencia % 3600) / 60),
                    seconds: diferencia % 60,
                };
                await session.save();
            }
    
            // Obtener solo las sesiones que siguen activas después de la actualización
            const currentActiveSessions = await Session.find({ status: "Activa" });
            
            res.status(200).json({
                count: currentActiveSessions.length,
                sessions: currentActiveSessions,
            });
    
        } catch (error) {
            res.status(500).json({ message: "Error al obtener sesiones", error: error.message });
        }
    });

  app.post('/deleteAllSessions', async (req, res) => {
      try {
          // Eliminar todas las sesiones de la base de datos
          await Session.deleteMany({});
          res.status(200).json({ message: "Todas las sesiones han sido eliminadas correctamente" });
      } catch (error) {
          res.status(500).json({ 
              message: "Error al eliminar las sesiones", 
              error: error.message 
          });
      }
  });