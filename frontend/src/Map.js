import React from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100vw',
  height: '100vh'
};

const center = {
  lat: -3.745,
  lng: -38.523
};

function Map() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "YOUR_API_KEY_HERE" // IMPORTANT: Replace with your actual API key
  })

  const [map, setMap] = React.useState(null)
  const [vehicles, setVehicles] = React.useState({});

  const onLoad = React.useCallback(function callback(map) {
    // This is just an example of how to fit the bounds.
    // You might want to adjust this based on your actual vehicle locations.
    const bounds = new window.google.maps.LatLngBounds(center);
    map.fitBounds(bounds);
    setMap(map)
  }, [])

  const onUnmount = React.useCallback(function callback(map) {
    setMap(null)
  }, [])

  React.useEffect(() => {
    // Fetch initial vehicle data
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(data => setVehicles(data))
      .catch(err => console.error("Error fetching vehicles:", err));

    // Establish WebSocket connection
    // The URL should match your backend's WebSocket server.
    // In development, you might need to use 'ws://localhost:8080'
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
      console.log('Connected to WebSocket');
    };

    ws.onmessage = (event) => {
      const updatedVehicle = JSON.parse(event.data);
      console.log('Received WebSocket message:', updatedVehicle);
      setVehicles(currentVehicles => ({
        ...currentVehicles,
        [updatedVehicle.id]: {
          lat: updatedVehicle.lat,
          lng: updatedVehicle.lng
        }
      }));
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Clean up the connection when the component unmounts
    return () => {
      ws.close();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

  return isLoaded ? (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {Object.keys(vehicles).map(id => (
          <Marker
            key={id}
            position={vehicles[id]}
          />
        ))}
      </GoogleMap>
  ) : <></>
}

export default React.memo(Map)