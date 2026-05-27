'use client';

import { useEffect } from 'react';

export default function LocationTracker() {
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
        );

        const data = await response.json();

        const userLocation = {
          city: (
            data.city ||
            data.locality ||
            "global"
          ).toLowerCase(),

          state: (
            data.principalSubdivision ||
            "global"
          ).toLowerCase(),
        };

        console.log("user location:", userLocation);

        // SAVE LOCATION
        localStorage.setItem(
          "user_location",
          JSON.stringify(userLocation)
        );
      },
      (error) => {
        console.log(
          'Location permission denied:',
          error.message
        );
      }
    );
  }, []);

  return null;
}