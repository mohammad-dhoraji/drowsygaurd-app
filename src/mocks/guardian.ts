export const mockDriver = {
  name: 'Rohan Mehta',
  vehicleId: 'GUARD-07',
  status: 'Monitoring',
  drowsinessLevel: 28,
  alertLevel: 'Low Risk',
  speedKph: 54,
  routeName: 'Airport Corridor',
  lastUpdated: new Date().toLocaleString(),
};

export const mockLogs = [
  {
    id: 'log-1',
    time: '08:14 AM',
    title: 'Camera feed active',
    detail: 'Driver attention monitoring resumed after ignition.',
    severity: 'info' as const,
  },
  {
    id: 'log-2',
    time: '08:21 AM',
    title: 'Blink duration spike detected',
    detail: 'Drowsiness score briefly increased to 34%.',
    severity: 'warning' as const,
  },
  {
    id: 'log-3',
    time: '08:27 AM',
    title: 'Guardian alert delivered',
    detail: 'In-app notification sent to supervising guardian.',
    severity: 'success' as const,
  },
];

export const mockLocation = {
  label: 'Pune, Maharashtra',
  latitude: 18.5204,
  longitude: 73.8567,
  accuracy: '12 m',
  heading: 'North-east',
  updatedAt: new Date().toLocaleTimeString(),
};
