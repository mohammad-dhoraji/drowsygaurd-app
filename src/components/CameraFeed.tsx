import { Platform } from 'react-native';

import NativeCameraFeed from '@/components/CameraFeed.native';
import WebCameraFeed from '@/components/CameraFeed.web';

const CameraFeed = Platform.OS === 'web' ? WebCameraFeed : NativeCameraFeed;

export default CameraFeed;
