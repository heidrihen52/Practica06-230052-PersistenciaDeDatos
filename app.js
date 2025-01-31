import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import os, { type } from 'os';
import macaddress from 'macaddress';
import moment from 'moment-timezone';
import mongoose from 'mongoose';

const app = express();
const PORT = 3000;

// MongoDB Atlas URI
const MONGO_URI = 'mongodb+srv://230052:Taco1995@hadrycluster.lbdby.mongodb.net/API-AWI4_0-230052?retryWrites=true&w=majority'; 

// Conectar a MongoDB Atlas
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((error) => console.error('Error al conectar con MongoDB Atlas:', error));

// Modelo de datos para sesiones
const SessionSchema = new mongoose.Schema({
  sessionID: {type:String, required: true, unique:true},
  email: {type:String, required:true},
  nickname: {type:String, required:true},
  status:{
    type:String,
    enum:["Activa", "Inactiva", "Finalizada por el usuario", "Finalizada por fallo del sistema"],
    default:"Activa"
  },
  createdAt: {type:Date, default:Date.now},
  lastAccessed: {type:Date, default:Date.now},
  clientData:{
    macAddress:{type:String},
    clientIp:{type:String}

  },
  serverData:{
    serverIp: {type:String},
    serverMac: {type:String}
  }
  
});

const SessionModel = mongoose.model('Session', SessionSchema);

app.listen(PORT, () => {
  console.log(`Server iniciado en http://localhost:${PORT}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {};

app.use(
  session({
    secret: "p4-APJ#pixelg7hadry-SesionesHTTP",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 5 * 60 * 1000 }
  })
);

app.get('/', (req, res) => {
  return res.status(200).json({
    message: 'Bienvenido a la API de control de sesiones',
    author: 'Adrián Pérez Jiménez'
  });
});

const getClientIp = (req) =>{
    return(
        req.header["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket?.remoteAddress
    )
}

const getLocalIp = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
};

const getServerMac = () => {
  return new Promise((resolve, reject) => {
    macaddress.one((err, mac) => {
      if (err) {
        reject(err);
      }
      resolve(mac);
    });
  });
};

app.post('/login', async (req, res) => {
    const { email, nickname, macAddress } = req.body;
    if (!email || !nickname || !macAddress) {
      return res.status(400).json({
        message: 'Se esperan campos requeridos'
      });
    }
  
    const sessionID = uuidv4();
    const createdAt_CDMX = moment().tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss'); // Convertido a Date
  
    req.session.email = email;
    req.session.sessionID = sessionID;
    req.session.nickname = nickname;
    req.session.createdAt = createdAt_CDMX;
    req.session.lastAccessed = createdAt_CDMX;
    req.session.clientData = { macAddress, clientIp: getClientIp(req) };
    req.session.serverData = { serverIp: getLocalIp(), serverMac: await getServerMac() };
  
    sessions[sessionID] = req.session;
  
    // Guardar la sesión en la base de datos
    const sessionData = new SessionModel({
      sessionID,
      email,
      nickname,
      status: "Activa", // Estado inicial
      createdAt: createdAt_CDMX,
      lastAccessed: createdAt_CDMX,
      clientData: {
        macAddress
      },
      serverData: {
        serverIp: getLocalIp(),
        serverMac: await getServerMac()
      }
    });
  
    try {
      await sessionData.save();
      res.status(200).json({
        message: 'Se ha logueado de manera exitosa',
        sessionID
      });
    } catch (error) {
      console.error('Error al guardar la sesión:', error);
      res.status(500).json({ message: 'Error al guardar la sesión' });
    }
  });


  app.post('/logout', async (req, res) => {
    if (!req.session.sessionID) {
        return res.status(404).json({ message: 'No existe una sesión activa' });
    }

    const sessionID = req.session.sessionID;
    try {
        await SessionModel.updateOne(
            { sessionID },
            { $set: { status: 'Finalizada por el usuario', lastAccessed: moment().tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss') } }
        );

        delete sessions[sessionID];

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Error al cerrar sesión' });
            }
            res.status(200).json({ message: 'Logout exitoso' });
        });
    } catch (error) {
        console.error('Error al cerrar la sesión:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/update', async (req, res) => {
  const { email, nickname } = req.body;

  if (!req.session.sessionID) {
      return res.status(404).json({ message: 'No existe una sesión activa' });
  }

  const sessionID = req.session.sessionID;
  const updateFields = {};
  if (email) updateFields.email = email;
  if (nickname) updateFields.nickname = nickname;
  updateFields.lastAccessed = moment().tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss');

  try {
      await SessionModel.updateOne(
          { sessionID },
          { $set: updateFields }
      );

      res.status(200).json({ message: 'Datos actualizados en la base de datos' });
  } catch (error) {
      console.error('Error al actualizar los datos de la sesión:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/status', async (req, res) => {
  const sessionID = req.query.sessionID;
  if (!sessionID) {
      return res.status(400).json({ message: 'Se requiere un sessionID' });
  }

  try {
      const session = await SessionModel.findOne({ sessionID });
      if (!session) {
          return res.status(404).json({ message: 'Sesión no encontrada' });
      }

      session.createdAt = moment(session.createdAt).tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss');
      session.lastAccessed = moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss');

      res.status(200).json({
          message: 'Estado de la sesión',
          session
      });
  } catch (error) {
      console.error('Error al obtener el estado de la sesión:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/sessions', async (req, res) => {
  try {
      const activeSessions = await SessionModel.find();
      if (activeSessions.length === 0) {
          return res.status(404).json({ message: 'No hay sesiones registradas' });
      }

      const formattedSessions = activeSessions.map(session => ({
          ...session._doc,
          createdAt: moment(session.createdAt).tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss'),
          lastAccessed: moment(session.lastAccessed).tz('America/Mexico_City').format('YYYY/MM/DD HH:mm:ss')
      }));

      res.status(200).json({
          message: 'Listado de sesiones',
          sessions: formattedSessions
      });
  } catch (error) {
      console.error('Error al obtener las sesiones:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
  }
});

setInterval(() => {
    const now = moment();
    for (const sessionID in sessions) {
        const session = sessions[sessionID];
        const idleTime = now.diff(moment(session.lastAccessed, 'YYYY/MM/DD HH:mm:ss'), 'seconds');
        if (idleTime > 120) { 
            delete sessions[sessionID];
        }
    }
}, 60000);

/*
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import macaddress from 'macaddress';

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server iniciado en http://localhost:${PORT}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {};

app.use(
    session({
        secret: "p4-APJ#pixelg7hadry-SesionesHTTP",
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 5 * 60 * 1000 }
    })
);

app.get('/', (req, res) => {
    return res.status(200).json({
        message: 'Bienvendio a la API de control de sesiones',
        author: 'Adrián Pérez Jiménez'
    });
});

const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
}

const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null; 
};

const getServerMac = () => {
    return new Promise((resolve, reject) => {
        macaddress.one((err, mac) => {
            if (err) {
                reject(err);
            }
            resolve(mac);
        });
    });
};

app.post('/login', async (req, res) => {
    const { email, nickname, macAddress } = req.body;
    if (!email || !nickname || !macAddress ) {
        return res.status(400).json({
            message: 'Se esperan campos requeridos'
        });
    }

    const sessionID = uuidv4();
    req.session.email = email;
    req.session.sessionID = sessionID;
    req.session.nickname = nickname;
    req.session.macAddress = macAddress;
    req.session.createdAt = new Date();
    req.session.lastAccessed = new Date();
    req.session.serverIp = getLocalIp();
    req.session.serverMac = await getServerMac();

    sessions[sessionID] = req.session;

    res.status(200).json({
        message: 'Se ha logueado de manera exitosa',
        sessionID
    });
});

app.post("/logout", (req, res) => {
    const { email, nickname } = req.body;

    if (!req.session.sessionID || !sessions[req.session.sessionID]) {
        return res.status(404).json({
            message: 'No existe una sesión activa'
        });
    }
    if (email) req.session.email = email;
    if (nickname) req.session.nickname = nickname;

    delete sessions[req.session.sessionID];
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: 'Error al cerrar sesión'
            });
        }
    });

    res.status(200).json({
        message: 'Logout exitoso'
    });
});

app.post("/update", (req, res) => {
    const { email, nickname } = req.body;

    if (!req.session.sessionID || !sessions[req.session.sessionID]) {
        return res.status(404).json({
            message: 'No existe una sesión activa'
        });
    }
    if (email) req.session.email = email;
    if (nickname) req.session.nickname = nickname;
    req.session.lastAccessed = new Date();

    sessions[req.session.sessionID] = req.session;

    res.status(200).json({
        message: 'Datos actualizados',
        session: req.session
    });
});

app.get("/status", (req, res) => {
    if (!req.session.sessionID || !sessions[req.session.sessionID]) {
        return res.status(404).json({
            message: 'No existe una sesión activa'
        });
    }

    const session = sessions[req.session.sessionID];
    const now = new Date();
    const idleTime = (now - new Date(session.lastAccessed)) / 1000;
    const duration = (now - new Date(session.createdAt)) / 1000; 

    res.status(200).json({
        message: 'Sesión activa',
        session,
        idleTime: `${idleTime} segundos`,
        duration: `${duration} segundos`
    });
});
app.get('/sessionactives', (req, res) => {
    if (Object.keys(sessions).length === 0) {
        return res.status(404).json({
            message: 'No hay sesiones activas'
        });
    }
    res.status(200).json({
        message: 'Sesiones activas',
        sessions
    });
});

setInterval(() => {
    const now = new Date();
    for (const sessionID in sessions) {
        const session = sessions[sessionID];
        const idleTime = (now - new Date(session.lastAccessed)) / 1000; 
        if (idleTime > 120) { // 2 minutos
            delete sessions[sessionID];
        }
    }
}, 60000);
*/