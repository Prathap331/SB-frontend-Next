'use client';

import { useEffect } from 'react';

export default function LocationTracker() {
  useEffect(() => {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    // Ask for location permission
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        console.log('User Location:', latitude, longitude);

        // OPTIONAL:
        // Send location to backend/database
        // await fetch('/api/save-location', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     latitude,
        //     longitude,
        //   }),
        // });
      },
      (error) => {
        console.log('Location permission denied or error:', error.message);
      }
    );
  }, []);

  return null;
}