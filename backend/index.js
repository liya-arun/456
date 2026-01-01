const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
const port = process.env.PORT || 8080;

// -- START FIREBASE INITIALIZATION --
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Firebase Admin SDK initialization failed.', error);
  console.error('Please ensure serviceAccountKey.json is present in the backend directory.');
}
const db = admin.firestore();
// -- END FIREBASE INITIALIZATION --

// Create an HTTP server from the Express app
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// --- API Routes (must be defined before the static serving and catch-all) ---
app.get('/api/vehicles', async (req, res) => {
    try {
        const vehiclesRef = db.collection('vehicles');
        const snapshot = await vehiclesRef.get();
        if (snapshot.empty) { return res.status(200).json({}); }
        const vehicles = {};
        snapshot.forEach(doc => { vehicles[doc.id] = doc.data(); });
        res.status(200).json(vehicles);
    } catch (error) {
        console.error('Error getting vehicles:', error);
        res.status(500).send({ message: 'Error getting vehicle data' });
    }
});

app.post('/api/gps', async (req, res) => {
    const { id, lat, lng } = req.body;
    if (!id || lat === undefined || lng === undefined) {
        return res.status(400).send({ message: 'Invalid GPS data.' });
    }
    try {
        const vehicleRef = db.collection('vehicles').doc(id);
        await vehicleRef.set({ lat, lng }, { merge: true });
        broadcast({ id, lat, lng });
        res.status(200).send({ message: 'GPS data received and saved' });
    } catch (error) {
        console.error('Error saving GPS data:', error);
        res.status(500).send({ message: 'Error saving GPS data' });
    }
});


// --- Static File Serving & App Routing ---
const frontendPath = path.join(__dirname, '../frontend/public');
app.use(express.static(frontendPath)); // Serves files like style.css, bundle.js

// Serve the landing page for the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'landing.html'));
});

// Serve the main React app for any /app path
app.get('/app*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
// --- End Static File Serving & App Routing ---

// Start the server
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
