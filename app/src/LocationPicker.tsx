import React, {useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {Button} from './components';
import Icon from './Icon';
import {useDialog} from './dialog';
import {api} from './api';
import {getLocation} from './location';
import {colors} from './theme';

export type PickedLocation = {lat: number; lng: number; address?: string; placeName?: string};
type Point = {lat: number; lng: number};

const DEFAULT_CENTER: Point = {lat: 22.9734, lng: 78.6569}; // middle of India, used only if GPS is unavailable

/** Map page: the pin stays in the middle of the screen, the owner moves the map under it. */
const mapHtml = (c: Point, zoom: number) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{margin:0;height:100%;width:100%}
.pin{position:absolute;left:50%;top:50%;width:40px;height:52px;margin:-52px 0 0 -20px;z-index:1000;pointer-events:none;transition:transform .15s}
.pin.up{transform:translateY(-10px)}
.dot{position:absolute;left:50%;top:50%;width:10px;height:5px;margin:-3px 0 0 -5px;border-radius:50%;background:rgba(0,0,0,.35);z-index:999;pointer-events:none}
#lay{position:absolute;top:12px;right:12px;z-index:1002;border:0;border-radius:20px;padding:10px 16px;background:#fff;color:#065E57;font:700 14px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.msg{position:absolute;top:50%;left:0;right:0;text-align:center;font:14px sans-serif;color:#6b7280;z-index:1001}
</style></head><body>
<div id="map"></div><button id="lay">Satellite</button><div class="dot"></div>
<svg class="pin" id="pin" viewBox="0 0 40 52"><path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#087E75"/><circle cx="20" cy="20" r="8" fill="#fff"/></svg>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
if(!window.L){document.body.insertAdjacentHTML('beforeend','<div class="msg">Could not load the map. Check your internet connection.</div>');send({error:true});}
else{
var map=L.map('map',{zoomControl:false,attributionControl:true,maxZoom:20}).setView([${c.lat},${c.lng}],${zoom});
var street=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,maxNativeZoom:19,attribution:'© OpenStreetMap'});
var sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,maxNativeZoom:17,attribution:'Esri, Maxar'});
var isSat=false;street.addTo(map);
document.getElementById('lay').onclick=function(){
  if(isSat){map.removeLayer(sat);street.addTo(map);this.textContent='Satellite';}
  else{map.removeLayer(street);sat.addTo(map);this.textContent='Map';}
  isSat=!isSat;
};
var pin=document.getElementById('pin');
map.on('movestart',function(){pin.classList.add('up')});
map.on('moveend',function(){pin.classList.remove('up');var p=map.getCenter();send({lat:p.lat,lng:p.lng});});
window.goTo=function(lat,lng){map.setView([lat,lng],17);};
send({lat:${c.lat},lng:${c.lng},ready:true});
}
</script></body></html>`;

/** Google Maps version of the same page (used when the server has a Maps API key). */
const googleHtml = (key: string, c: Point, zoom: number) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
html,body,#map{margin:0;height:100%;width:100%}
.pin{position:absolute;left:50%;top:50%;width:40px;height:52px;margin:-52px 0 0 -20px;z-index:10;pointer-events:none;transition:transform .15s}
.pin.up{transform:translateY(-10px)}
.dot{position:absolute;left:50%;top:50%;width:10px;height:5px;margin:-3px 0 0 -5px;border-radius:50%;background:rgba(0,0,0,.35);z-index:9;pointer-events:none}
#lay{position:absolute;top:12px;right:12px;z-index:11;border:0;border-radius:20px;padding:10px 16px;background:#fff;color:#065E57;font:700 14px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.msg{position:absolute;top:45%;left:16px;right:16px;text-align:center;font:14px sans-serif;color:#b91c1c}
</style></head><body>
<div id="map"></div><div class="dot"></div><button id="lay">Satellite</button>
<svg class="pin" id="pin" viewBox="0 0 40 52"><path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#087E75"/><circle cx="20" cy="20" r="8" fill="#fff"/></svg>
<script>
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
window.gm_authFailure=function(){document.body.insertAdjacentHTML('beforeend','<div class="msg">Google Maps rejected the API key. Check the key and its restrictions.</div>');};
function init(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${c.lat},lng:${c.lng}},zoom:${zoom},
    disableDefaultUI:true,gestureHandling:'greedy',clickableIcons:false});
  var pin=document.getElementById('pin'),sat=false;
  map.addListener('dragstart',function(){pin.classList.add('up')});
  map.addListener('idle',function(){pin.classList.remove('up');var p=map.getCenter();send({lat:p.lat(),lng:p.lng()});});
  document.getElementById('lay').onclick=function(){sat=!sat;map.setMapTypeId(sat?'hybrid':'roadmap');this.textContent=sat?'Map':'Satellite';};
  window.goTo=function(lat,lng){map.setCenter({lat:lat,lng:lng});map.setZoom(17);};
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=init"></script>
</body></html>`;

/**
 * "Update location" opens a map. The owner moves the map until the pin is on the shop and confirms.
 * It starts on the saved shop position, otherwise on the phone's GPS position.
 */
export default function LocationPicker({shopName, saved, label, onPick, initial}: {
  shopName: string;
  saved: boolean;
  label?: string;
  onPick: (p: PickedLocation) => void;
  initial?: Point | null;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<{c: Point; zoom: number}>({c: DEFAULT_CENTER, zoom: 5});
  const [gkey, setGkey] = useState<string | null>(null);
  const [pin, setPin] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const web = useRef<React.ComponentRef<typeof WebView>>(null);

  const openMap = async () => {
    if (!shopName.trim()) return;
    setBusy(true);
    let c: Point | null = initial || null;
    if (!c) {
      try { c = await getLocation(); } catch (e: any) {
        dialog.alert({title: 'Location not available', message: `${e.message}\n\nYou can still move the map to your shop.`, kind: 'info'});
      }
    }
    try { setGkey((await api<{key: string | null}>('/public/maps-config')).key); } catch { setGkey(null); }
    setStart(c ? {c, zoom: 17} : {c: DEFAULT_CENTER, zoom: 5});
    setPin(c);
    setBusy(false);
    setOpen(true);
  };

  const goToMe = async () => {
    setLocating(true);
    try {
      const me = await getLocation();
      web.current?.injectJavaScript(`window.goTo(${me.lat},${me.lng});true;`);
    } catch (e: any) {
      dialog.alert({title: 'Location not available', message: e.message, kind: 'error'});
    } finally { setLocating(false); }
  };

  const confirm = () => {
    if (!pin) return;
    setOpen(false);
    onPick(pin);
  };

  return (
    <>
      <Button kind={saved ? 'soft' : 'outline'} loading={busy} disabled={!shopName.trim()}
        icon={saved ? 'checkmark-circle' : 'location'}
        title={label || (saved ? 'Location saved (tap to update)' : 'Select shop location on map')}
        onPress={openMap} />
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
          <StatusBar barStyle="dark-content" />
          <View style={s.header}>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} style={s.close}>
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
            <View style={{flex: 1}}>
              <Text style={s.title}>Select shop location</Text>
              <Text style={s.sub} numberOfLines={1}>Move the map so the pin is on {shopName.trim() || 'your shop'}</Text>
            </View>
          </View>
          <View style={{flex: 1}}>
            <WebView key={open ? "o" : "c"} ref={web} originWhitelist={['*']} source={{html: gkey ? googleHtml(gkey, start.c, start.zoom) : mapHtml(start.c, start.zoom), baseUrl: 'https://localhost/'}}
              javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false}
              onMessage={e => {
                try {
                  const m = JSON.parse(e.nativeEvent.data);
                  if (typeof m.lat === 'number') setPin({lat: m.lat, lng: m.lng});
                } catch {}
              }}
              startInLoadingState renderLoading={() => <ActivityIndicator style={s.loader} color={colors.primary} size="large" />} />
            <Pressable style={s.me} onPress={goToMe} disabled={locating}>
              {locating ? <ActivityIndicator color={colors.primaryDark} /> : <Icon name="locate" size={24} color={colors.primaryDark} />}
            </Pressable>
          </View>
          <View style={s.footer}>
            <Button title="Use this location" icon="location" onPress={confirm} disabled={!pin} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff'},
  close: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 14, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, fontSize: 12},
  loader: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0},
  me: {
    position: 'absolute', right: 14, bottom: 18, width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: {width: 0, height: 2},
  },
  footer: {backgroundColor: '#fff', padding: 16},
});
