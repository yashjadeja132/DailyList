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

let configured = false;
/** Use Google's location service when the phone has it (more reliable than the plain Android one). */
function configure() {
  if (configured) return;
  configured = true;
  try { Geolocation.setRNConfiguration({skipPermissionRequests: true, authorizationLevel: 'whenInUse', locationProvider: 'auto'}); } catch {}
}

const once = (options: {enableHighAccuracy: boolean; timeout: number; maximumAge: number}) =>
  new Promise<Coords>((resolve, reject) => {
    Geolocation.getCurrentPosition(p => resolve({lat: p.coords.latitude, lng: p.coords.longitude}), e => reject(e), options);
  });

const failure = (e: any) =>
  e && e.code === 1
    ? new LocationError('Location permission was not allowed.', true)
    : e && e.code === 3
      ? new LocationError('Could not find your position in time. Try near a window or outside.')
      : new LocationError('Location is switched off on this phone. Turn it on in the quick settings, then try again.');

/** Asks for permission (if needed) and returns the phone's current position. */
export async function getLocation(): Promise<Coords> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (r !== PermissionsAndroid.RESULTS.GRANTED)
      throw new LocationError('Location permission was not allowed.', true);
  }
  configure();
  try {
    // fast and light first: network position, up to 10 minutes old
    return await once({enableHighAccuracy: false, timeout: 10000, maximumAge: 600000});
  } catch (e: any) {
    if (e && e.code === 1) throw failure(e);
    try {
      // then the GPS itself
      return await once({enableHighAccuracy: true, timeout: 20000, maximumAge: 600000});
    } catch (e2: any) {
      throw failure(e2);
    }
  }
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
