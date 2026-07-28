// Mock data for Shgps.ma Demo

export const clients = [
  {
    id: 'c1',
    name: 'محمد العلوي',
    email: 'mohammed.alaoui@gmail.com',
    phone: '+212 6 12 34 56 78',
    city: 'الدار البيضاء',
    subscription: 'Pro',
    status: 'active',
    devicesCount: 3,
    joinDate: '2024-03-15',
    avatar: 'م'
  },
  {
    id: 'c2',
    name: 'فاطمة بنسالم',
    email: 'fatima.bensalem@hotmail.com',
    phone: '+212 6 98 76 54 32',
    city: 'الرباط',
    subscription: 'Basic',
    status: 'active',
    devicesCount: 2,
    joinDate: '2024-05-20',
    avatar: 'ف'
  },
  {
    id: 'c3',
    name: 'يوسف الإدريسي',
    email: 'youssef.idrissi@gmail.com',
    phone: '+212 6 55 44 33 22',
    city: 'مراكش',
    subscription: 'Pro',
    status: 'active',
    devicesCount: 2,
    joinDate: '2024-01-10',
    avatar: 'ي'
  },
  {
    id: 'c4',
    name: 'خديجة الزيد',
    email: 'khadija.zaid@yahoo.fr',
    phone: '+212 6 77 88 99 00',
    city: 'فاس',
    subscription: 'Basic',
    status: 'inactive',
    devicesCount: 1,
    joinDate: '2024-07-01',
    avatar: 'خ'
  },
  {
    id: 'c5',
    name: 'عمر بلعيد',
    email: 'omar.belaid@gmail.com',
    phone: '+212 6 33 22 11 00',
    city: 'أكادير',
    subscription: 'Enterprise',
    status: 'active',
    devicesCount: 4,
    joinDate: '2023-11-05',
    avatar: 'ع'
  }
]

// Morocco coordinates (lat, lng)
export const moroccoCoords = {
  casablanca: [33.5731, -7.5898],
  rabat: [34.0209, -6.8416],
  marrakech: [31.6295, -7.9811],
  fes: [34.0181, -5.0078],
  agadir: [30.4278, -9.5981],
}

export const devices = [
  // Client 1 - Casablanca
  {
    id: 'd1',
    clientId: 'c1',
    imei: '358900001234567',
    name: 'سيارة محمد - تويوتا',
    type: 'car',
    plate: 'A 12345 CA',
    status: 'online',
    lat: 33.5731,
    lng: -7.5898,
    speed: 62,
    battery: 87,
    signal: 4,
    lastUpdate: new Date().toISOString(),
    engineOn: true,
    fuel: 68,
    totalDistance: 12450,
    trips: [
      { id: 't1', date: '2025-07-27', start: '08:15', end: '09:02', distance: 18.5, from: 'الدار البيضاء المركز', to: 'عين السبع' },
      { id: 't2', date: '2025-07-27', start: '12:30', end: '13:15', distance: 22.1, from: 'عين السبع', to: 'المحمدية' },
      { id: 't3', date: '2025-07-26', start: '07:45', end: '08:30', distance: 15.8, from: 'الدار البيضاء', to: 'سيدي مع عريف' },
    ]
  },
  {
    id: 'd2',
    clientId: 'c1',
    imei: '358900001234568',
    name: 'دراجة نارية - هوندا',
    type: 'bike',
    plate: 'B 98765 CA',
    status: 'online',
    lat: 33.5900,
    lng: -7.6100,
    speed: 38,
    battery: 52,
    signal: 3,
    lastUpdate: new Date(Date.now() - 120000).toISOString(),
    engineOn: true,
    fuel: 45,
    totalDistance: 8200,
    trips: [
      { id: 't4', date: '2025-07-27', start: '10:00', end: '10:25', distance: 8.3, from: 'السيدة زينب', to: 'أنفا' },
    ]
  },
  {
    id: 'd3',
    clientId: 'c1',
    imei: '358900001234569',
    name: 'شاحنة التوزيع',
    type: 'truck',
    plate: 'C 11111 CA',
    status: 'offline',
    lat: 33.5600,
    lng: -7.5700,
    speed: 0,
    battery: 91,
    signal: 0,
    lastUpdate: new Date(Date.now() - 3600000 * 2).toISOString(),
    engineOn: false,
    fuel: 82,
    totalDistance: 45000,
    trips: []
  },
  // Client 2 - Rabat
  {
    id: 'd4',
    clientId: 'c2',
    imei: '358900001234570',
    name: 'رينو كليو',
    type: 'car',
    plate: 'A 55555 RB',
    status: 'online',
    lat: 34.0209,
    lng: -6.8416,
    speed: 45,
    battery: 73,
    signal: 4,
    lastUpdate: new Date().toISOString(),
    engineOn: true,
    fuel: 55,
    totalDistance: 22100,
    trips: [
      { id: 't5', date: '2025-07-27', start: '09:00', end: '09:45', distance: 12.0, from: 'الرباط أكدال', to: 'حي الرياض' },
    ]
  },
  {
    id: 'd5',
    clientId: 'c2',
    imei: '358900001234571',
    name: 'داستر - فاطمة',
    type: 'car',
    plate: 'B 44444 RB',
    status: 'offline',
    lat: 34.0100,
    lng: -6.8200,
    speed: 0,
    battery: 30,
    signal: 1,
    lastUpdate: new Date(Date.now() - 3600000).toISOString(),
    engineOn: false,
    fuel: 25,
    totalDistance: 18750,
    trips: []
  },
  // Client 3 - Marrakech
  {
    id: 'd6',
    clientId: 'c3',
    imei: '358900001234572',
    name: 'تاكسي مراكش 1',
    type: 'car',
    plate: 'A 22222 MR',
    status: 'online',
    lat: 31.6295,
    lng: -7.9811,
    speed: 55,
    battery: 95,
    signal: 4,
    lastUpdate: new Date().toISOString(),
    engineOn: true,
    fuel: 72,
    totalDistance: 67000,
    trips: []
  },
  {
    id: 'd7',
    clientId: 'c3',
    imei: '358900001234573',
    name: 'تاكسي مراكش 2',
    type: 'car',
    plate: 'B 33333 MR',
    status: 'online',
    lat: 31.6380,
    lng: -7.9950,
    speed: 30,
    battery: 78,
    signal: 3,
    lastUpdate: new Date(Date.now() - 60000).toISOString(),
    engineOn: true,
    fuel: 60,
    totalDistance: 54200,
    trips: []
  },
  // Client 4 - Fes
  {
    id: 'd8',
    clientId: 'c4',
    imei: '358900001234574',
    name: 'بيجو 208 - فاس',
    type: 'car',
    plate: 'A 77777 FS',
    status: 'offline',
    lat: 34.0181,
    lng: -5.0078,
    speed: 0,
    battery: 15,
    signal: 0,
    lastUpdate: new Date(Date.now() - 3600000 * 5).toISOString(),
    engineOn: false,
    fuel: 40,
    totalDistance: 9800,
    trips: []
  },
  // Client 5 - Agadir
  {
    id: 'd9',
    clientId: 'c5',
    imei: '358900001234575',
    name: 'أسطول التوزيع 1',
    type: 'truck',
    plate: 'A 88888 AG',
    status: 'online',
    lat: 30.4278,
    lng: -9.5981,
    speed: 78,
    battery: 88,
    signal: 4,
    lastUpdate: new Date().toISOString(),
    engineOn: true,
    fuel: 65,
    totalDistance: 85000,
    trips: []
  },
  {
    id: 'd10',
    clientId: 'c5',
    imei: '358900001234576',
    name: 'أسطول التوزيع 2',
    type: 'truck',
    plate: 'B 99999 AG',
    status: 'online',
    lat: 30.4150,
    lng: -9.5750,
    speed: 65,
    battery: 76,
    signal: 3,
    lastUpdate: new Date(Date.now() - 90000).toISOString(),
    engineOn: true,
    fuel: 48,
    totalDistance: 72000,
    trips: []
  }
]

export const alerts = [
  {
    id: 'a1',
    deviceId: 'd1',
    deviceName: 'سيارة محمد - تويوتا',
    clientId: 'c1',
    type: 'speed',
    severity: 'warning',
    message: 'تجاوز السرعة المحددة (120 كم/ساعة)',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    read: false,
    lat: 33.5800,
    lng: -7.5950,
  },
  {
    id: 'a2',
    deviceId: 'd2',
    deviceName: 'دراجة نارية - هوندا',
    clientId: 'c1',
    type: 'geofence',
    severity: 'danger',
    message: 'خروج من المنطقة الجغرافية المحددة',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    read: false,
    lat: 33.6100,
    lng: -7.6300,
  },
  {
    id: 'a3',
    deviceId: 'd5',
    deviceName: 'داستر - فاطمة',
    clientId: 'c2',
    type: 'battery',
    severity: 'warning',
    message: 'مستوى البطارية منخفض (30%)',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    lat: 34.0100,
    lng: -6.8200,
  },
  {
    id: 'a4',
    deviceId: 'd3',
    deviceName: 'شاحنة التوزيع',
    clientId: 'c1',
    type: 'power',
    severity: 'danger',
    message: 'انقطاع مصدر الطاقة الخارجي',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: true,
    lat: 33.5600,
    lng: -7.5700,
  },
  {
    id: 'a5',
    deviceId: 'd8',
    deviceName: 'بيجو 208 - فاس',
    clientId: 'c4',
    type: 'battery',
    severity: 'danger',
    message: 'البطارية حرجة (15%) - خطر انقطاع الاتصال',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    read: true,
    lat: 34.0181,
    lng: -5.0078,
  },
  {
    id: 'a6',
    deviceId: 'd6',
    deviceName: 'تاكسي مراكش 1',
    clientId: 'c3',
    type: 'speed',
    severity: 'warning',
    message: 'تجاوز السرعة (110 كم/ساعة)',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    read: false,
    lat: 31.6295,
    lng: -7.9811,
  },
  {
    id: 'a7',
    deviceId: 'd9',
    deviceName: 'أسطول التوزيع 1',
    clientId: 'c5',
    type: 'engine',
    severity: 'info',
    message: 'تشغيل المحرك عن بعد - بواسطة الأدمن',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    read: false,
    lat: 30.4278,
    lng: -9.5981,
  }
]

export const carouselSlides = [
  {
    id: 1,
    title: 'شارك التطبيق، احصل على شهر مجاني!',
    subtitle: 'ادع أصدقاءك لتركيب GPS واحصل على خصم حصري',
    bg: 'linear-gradient(135deg, #0F2044 0%, #1a3a6e 100%)',
    accent: '#00D97E',
    icon: '🎁',
    cta: 'شارك الآن'
  },
  {
    id: 2,
    title: 'تتبع أجهزتك في الوقت الفعلي',
    subtitle: 'راقب موقع وسرعة جميع مركباتك من مكان واحد',
    bg: 'linear-gradient(135deg, #006644 0%, #00D97E 100%)',
    accent: '#ffffff',
    icon: '📍',
    cta: 'اكتشف المزيد'
  },
  {
    id: 3,
    title: 'تنبيهات فورية على هاتفك',
    subtitle: 'احصل على إشعارات فورية عند تجاوز السرعة أو الخروج من المنطقة',
    bg: 'linear-gradient(135deg, #7B2D00 0%, #FF9500 100%)',
    accent: '#ffffff',
    icon: '🔔',
    cta: 'ضبط التنبيهات'
  },
  {
    id: 4,
    title: 'قطع المحرك عن بعد',
    subtitle: 'أوقف مركبتك من أي مكان في حالة السرقة أو الطوارئ',
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #6B21A8 100%)',
    accent: '#00D97E',
    icon: '🔒',
    cta: 'معرفة المزيد'
  }
]

export const adminStats = {
  totalClients: 5,
  totalDevices: 10,
  onlineDevices: 6,
  offlineDevices: 4,
  todayAlerts: 7,
  unreadAlerts: 4,
  monthlyRevenue: 4850,
  activeSubscriptions: 4
}

export const revenueData = [
  { month: 'يناير', revenue: 3200, clients: 8 },
  { month: 'فبراير', revenue: 3800, clients: 10 },
  { month: 'مارس', revenue: 4100, clients: 12 },
  { month: 'أبريل', revenue: 3900, clients: 11 },
  { month: 'مايو', revenue: 4500, clients: 14 },
  { month: 'يونيو', revenue: 4200, clients: 13 },
  { month: 'يوليو', revenue: 4850, clients: 15 },
]

export const deviceStatusData = [
  { name: 'متصل', value: 6, color: '#00D97E' },
  { name: 'غير متصل', value: 4, color: '#94A3B8' },
]

// Demo credentials
export const DEMO_CLIENT = { email: 'demo@shgps.ma', password: '123456' }
export const DEMO_ADMIN = { email: 'admin@shgps.ma', password: 'admin123' }
