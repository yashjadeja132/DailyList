import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type Coords = {lat: number; lng: number};

export class LocationError extends Error {
  denied: boolean;
  constructor(message: string, denied = false) {
    super(message);
    this.denied = denied;
  }
}

/** Asks for permission (if needed) and returns the phone's current position. */
export async function getLocation(): Promise<Coords> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (r !== PermissionsAndroid.RESULTS.GRANTED)
      throw new LocationError('Location permission was not allowed.', true);
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      p => resolve({lat: p.coords.latitude, lng: p.coords.longitude}),
      e => reject(new LocationError(
        e.code === 1 ? 'Location permission was not allowed.' :
          'Could not get your location. Make sure location is turned on.', e.code === 1)),
      {enableHighAccuracy: false, timeout: 20000, maximumAge: 120000},
    );
  });
}

// An area the user picked by hand (used when the phone's location is off or denied).
let manual: (Coords & {label: string}) | null = null;
export const setManualLocation = (c: Coords | null, label = '') => { manual = c ? {...c, label} : null; };
export const getManualLabel = () => manual?.label || '';

/** The phone's position, or the area the user picked by hand when the phone cannot tell. */
export async function getBestLocation(): Promise<Coords> {
  try { return await getLocation(); } catch (e) {
    if (manual) return {lat: manual.lat, lng: manual.lng};
    throw e;
  }
}
