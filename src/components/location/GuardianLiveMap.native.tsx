import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface GuardianLiveMapProps {
  description?: string;
  latitude: number;
  longitude: number;
  title: string;
}

const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = 0.01;
export default function GuardianLiveMap({
  description,
  latitude,
  longitude,
  title,
}: GuardianLiveMapProps) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !lat ||
    !lng ||
    isNaN(lat) ||
    isNaN(lng)
  ) {
    console.log("Invalid coordinates:", { latitude, longitude });
    return null;
  }

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }}
    >
      <Marker
        coordinate={{ latitude: lat, longitude: lng }}
        description={description}
        title={title}
      />
    </MapView>
  );
}