const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const WebSocket = require('ws');
const path = require('path'); // Add path module

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

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Function to broadcast data to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

app.get('/api/vehicles', async (req, res) => {
    try {
        const vehiclesRef = db.collection('vehicles');
        const snapshot = await vehiclesRef.get();
        if (snapshot.empty) {
            return res.status(200).json({});
        }
        const vehicles = {};
        snapshot.forEach(doc => {
            vehicles[doc.id] = doc.data();
        });
        res.status(200).json(vehicles);
    } catch (error) {
        console.error('Error getting vehicles:', error);
        res.status(500).send({ message: 'Error getting vehicle data' });
    }
});

app.post('/api/gps', async (req, res) => {
    const { id, lat, lng } = req.body;
    if (!id || lat === undefined || lng === undefined) {
        return res.status(400).send({ message: 'Invalid GPS data. "id", "lat", and "lng" are required.' });
    }
    console.log('Received GPS data:', req.body);

    try {
        const vehicleRef = db.collection('vehicles').doc(id);
        await vehicleRef.set({ lat, lng }, { merge: true });
        
        // Broadcast the update to all WebSocket clients
        broadcast({ id, lat, lng });

        res.status(200).send({ message: 'GPS data received and saved' });
    } catch (error) {
        console.error('Error saving GPS data:', error);
        res.status(500).send({ message: 'Error saving GPS data' });
    }
});


// --- Static File Serving ---
// Serve the built frontend files from the 'public' directory of the 'frontend' package
const frontendPath = path.join(__dirname, '../frontend/public');
app.use(express.static(frontendPath));

// For any request that doesn't match a static file or an API route,
// serve the index.html file. This is for client-side routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
// --- End Static File Serving ---


// Start the server
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
