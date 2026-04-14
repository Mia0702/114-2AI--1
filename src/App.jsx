import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  Home,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  Plus,
  Trash2,
  ChevronRight,
  Users,
  AlertTriangle,
  CheckCircle,
  Wifi,
  RefreshCw,
  XCircle,
  BedDouble,
  CalendarCheck2,
  BarChart3,
  Wrench,
  Pencil,
  Save,
  Search,
  DoorOpen,
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyCXTX3ltta9wqg-qLFl4V4B6-4VhjklOVo",
  authDomain: "aiproject-8feb5.firebaseapp.com",
  projectId: "aiproject-8feb5",
  storageBucket: "aiproject-8feb5.firebasestorage.app",
  messagingSenderId: "63987354975",
  appId: "1:63987354975:web:8e62caaa31b3fe1afa3aea",
  measurementId: "G-GH0YX3JXQQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'minisu-booking-sys-v2';

// --- 預設推薦房型資料 ---
const FEATURED_ROOMS = [
  {
    id: 'f1',
    name: '雲端山景雙人房',
    price: 3200,
    capacity: 2,
    totalRooms: 5,
    description: '坐擁 180 度大面採光落地窗，清晨醒來即可見雲海繚繞，享受最純淨的山林氣息。',
    icon: '🏔️',
    amenities: ['免費 WiFi', '景觀窗', '早餐'],
    status: '開放'
  },
  {
    id: 'f2',
    name: '蔚藍海岸大床房',
    price: 3800,
    capacity: 2,
    totalRooms: 3,
    description: '特選頂級獨立筒床墊，陽台可遠眺太平洋海岸線，聆聽海浪拍打礁石的自然協奏曲。',
    icon: '🌊',
    amenities: ['免費 WiFi', '海景陽台', '早餐'],
    status: '開放'
  },
  {
    id: 'f3',
    name: '森呼吸家族套房',
    price: 5600,
    capacity: 4,
    totalRooms: 2,
    description: '寬敞的四人空間，室內採原木設計，適合全家大小共同體驗森林芬多精的洗禮。',
    icon: '🌲',
    amenities: ['免費 WiFi', '家庭房', '浴缸'],
    status: '開放'
  },
  {
    id: 'f4',
    name: '星空觀測閣樓房',
    price: 4200,
    capacity: 2,
    totalRooms: 2,
    description: '獨特斜頂設計搭配電動天窗，躺在床上就能與另一半細數繁星，共度浪漫夜晚。',
    icon: '✨',
    amenities: ['免費 WiFi', '天窗', '雙人房'],
    status: '開放'
  },
  {
    id: 'f5',
    name: '日式禪風景觀房',
    price: 4500,
    capacity: 3,
    totalRooms: 3,
    description: '榻榻米空間搭配手工檜木桶浴缸，在簡約禪意的氛圍中洗滌心靈的疲憊。',
    icon: '🍵',
    amenities: ['免費 WiFi', '檜木桶浴', '景觀房'],
    status: '開放'
  }
];

const ROOM_STATUS_OPTIONS = ['開放', '停用', '維護'];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(localStorage.getItem('userRole') || 'guest');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(localStorage.getItem('isAdminLoggedIn') === 'true');

  const [roomTypes, setRoomTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({ adminPassword: '1234' });
  const [view, setView] = useState('home');
  const [message, setMessage] = useState(null);
  const [preSelectedRoom, setPreSelectedRoom] = useState('');

  // 合併預設房型 + 資料庫自訂房型
  const effectiveRoomTypes = useMemo(() => {
    const map = new Map();

    FEATURED_ROOMS.forEach((room) => {
      map.set(room.id, room);
    });

    roomTypes.forEach((room) => {
      map.set(room.id, {
        amenities: room.amenities || ['免費 WiFi'],
        status: room.status || '開放',
        ...room
      });
    });

    return Array.from(map.values());
  }, [roomTypes]);

  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qRooms = collection(db, 'artifacts', appId, 'public', 'data', 'roomTypes');
    const unsubRooms = onSnapshot(
      qRooms,
      (snapshot) => {
        const roomsData = snapshot.docs.map((roomDoc) => ({
          id: roomDoc.id,
          ...roomDoc.data()
        }));
        setRoomTypes(roomsData);
        setLoading(false);
      },
      (err) => console.error(err)
    );

    const qBookings = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(
      qBookings,
      (snapshot) => {
        const bookingsData = snapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data()
        }));
        bookingsData.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
        setBookings(bookingsData);
      },
      (err) => console.error(err)
    );

    const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
    const unsubSettings = onSnapshot(
      settingsDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        } else {
          setDoc(settingsDoc, { adminPassword: '1234' });
        }
      },
      (err) => console.error(err)
    );

    return () => {
      unsubRooms();
      unsubBookings();
      unsubSettings();
    };
  }, [user]);

  const toast = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdminLogin = () => {
    const password = prompt("請輸入管理員密碼 (預設: 1234)：");
    if (!password) return;

    if (password === settings.adminPassword) {
      setRole('admin');
      setIsAdminLoggedIn(true);
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('isAdminLoggedIn', 'true');
      toast("管理員登入成功");
    } else {
      toast("密碼錯誤", "error");
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setIsAdminLoggedIn(false);
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAdminLoggedIn');
    setView('home');
    toast("已登出系統");
  };

  const handleRebook = (roomTypeId) => {
    setPreSelectedRoom(roomTypeId);
    setView('booking');
  };

  const checkAvailability = (roomTypeId, checkIn, checkOut, bookingId = null) => {
    const selectedRoomType = effectiveRoomTypes.find((r) => r.id === roomTypeId);
    if (!selectedRoomType) return 0;
    if ((selectedRoomType.status || '開放') !== '開放') return 0;

    const totalRooms = parseInt(selectedRoomType.totalRooms || 0, 10);
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return totalRooms;
    }

    const overlapping = bookings.filter((b) => {
      if (b.roomTypeId !== roomTypeId || b.status === '已取消' || b.status === '已退房') return false;
      if (bookingId && b.id === bookingId) return false;
      return start < new Date(b.checkOutDate) && end > new Date(b.checkInDate);
    });

    return Math.max(0, totalRooms - overlapping.length);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">系統載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      {message && (
        <div
          className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 ${
            message.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
          }`}
        >
          {message.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            <div className="bg-blue-600 p-2 rounded-xl text-white group-hover:rotate-6 transition-transform">
              <Home size={24} />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">自在雲端民宿</h1>
          </div>

          <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <NavTab active={view === 'home'} onClick={() => setView('home')} label="探索首頁" />
            <NavTab active={view === 'booking'} onClick={() => setView('booking')} label="立即訂房" />
            <NavTab active={view === 'my-bookings'} onClick={() => setView('my-bookings')} label="我的行程" />
            {role === 'admin' && (
              <>
                <div className="w-[1px] h-4 bg-slate-300 mx-2" />
                <NavTab active={view === 'admin-rooms'} onClick={() => setView('admin-rooms')} label="房型管理" />
                <NavTab active={view === 'admin-bookings'} onClick={() => setView('admin-bookings')} label="訂單總覽" />
                <NavTab active={view === 'admin-settings'} onClick={() => setView('admin-settings')} label="系統設定" />
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isAdminLoggedIn ? (
              <button
                onClick={handleAdminLogin}
                className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
              >
                管理登入
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors"
              >
                <LogOut size={16} /> 登出
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-10">
        {view === 'home' && (
          <HomeView
            roomTypes={effectiveRoomTypes}
            bookings={bookings}
            checkAvailability={checkAvailability}
            setView={setView}
            role={role}
          />
        )}

        {view === 'booking' && (
          <BookingFormView
            roomTypes={effectiveRoomTypes}
            checkAvailability={checkAvailability}
            toast={toast}
            setView={setView}
            initialRoomId={preSelectedRoom}
            clearPreSelected={() => setPreSelectedRoom('')}
          />
        )}

        {view === 'my-bookings' && (
          <OrderListView bookings={bookings} toast={toast} role="guest" onRebook={handleRebook} />
        )}

        {role === 'admin' && (
          <>
            {view === 'admin-rooms' && <AdminRoomTypes roomTypes={roomTypes} toast={toast} />}
            {view === 'admin-bookings' && (
              <OrderListView bookings={bookings} toast={toast} role="admin" onRebook={handleRebook} />
            )}
            {view === 'admin-settings' && <AdminSettings settings={settings} toast={toast} />}
          </>
        )}
      </main>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-3 px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <MobileNav active={view === 'home'} onClick={() => setView('home')} icon={<Home size={20} />} label="首頁" />
        <MobileNav
          active={view === 'booking'}
          onClick={() => setView('booking')}
          icon={<Calendar size={20} />}
          label="訂房"
        />
        <MobileNav
          active={view === 'my-bookings'}
          onClick={() => setView('my-bookings')}
          icon={<ClipboardList size={20} />}
          label="訂單"
        />
        {role === 'admin' && (
          <MobileNav
            active={view.startsWith('admin')}
            onClick={() => setView('admin-rooms')}
            icon={<Settings size={20} />}
            label="後台"
          />
        )}
      </div>
    </div>
  );
}

// --- 首頁 ---
function HomeView({ roomTypes, bookings, checkAvailability, setView, role }) {
  const [showAll, setShowAll] = useState(false);
  const [dateFilter, setDateFilter] = useState({ checkIn: '', checkOut: '' });

  const homeStats = useMemo(() => {
    const bookableRooms = roomTypes.filter((room) => (room.status || '開放') === '開放');
    const bookingCount = bookings.length;
    const reservedCount = bookings.filter((b) => b.status === '已預訂').length;
    const checkedInCount = bookings.filter((b) => b.status === '已入住').length;
    const checkedOutCount = bookings.filter((b) => b.status === '已退房').length;
    const cancelledCount = bookings.filter((b) => b.status === '已取消').length;

    return {
      roomTypeCount: roomTypes.length,
      bookableCount: bookableRooms.length,
      bookingCount,
      reservedCount,
      checkedInCount,
      checkedOutCount,
      cancelledCount,
    };
  }, [roomTypes, bookings]);

  const roomsWithAvailability = useMemo(() => {
    return roomTypes.map((room) => {
      const available = dateFilter.checkIn && dateFilter.checkOut
        ? checkAvailability(room.id, dateFilter.checkIn, dateFilter.checkOut)
        : (room.status || '開放') === '開放'
          ? parseInt(room.totalRooms || 0, 10)
          : 0;

      return {
        ...room,
        availableCount: available,
      };
    });
  }, [roomTypes, dateFilter, checkAvailability]);

  const filteredRooms = useMemo(() => {
    if (dateFilter.checkIn && dateFilter.checkOut) {
      return roomsWithAvailability.filter((room) => room.availableCount > 0);
    }
    return roomsWithAvailability;
  }, [roomsWithAvailability, dateFilter]);

  const displayRooms = showAll ? filteredRooms : filteredRooms.slice(0, 3);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <StatsDashboard stats={homeStats} role={role} />

      <section className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">房型與空房查詢</h2>
            <p className="text-slate-500 font-medium">輸入入住與退房日期，立即查看剩餘空房數量</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2">入住日期</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={dateFilter.checkIn}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, checkIn: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2">退房日期</label>
              <input
                type="date"
                min={dateFilter.checkIn || new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={dateFilter.checkOut}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, checkOut: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={() => setDateFilter({ checkIn: '', checkOut: '' })}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-4 py-3 rounded-2xl transition-colors"
              >
                清除條件
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">熱門房型推薦</h2>
            <p className="text-slate-500 font-medium">嚴選特色空間，給您最完美的住宿體驗</p>
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 text-blue-600 font-bold hover:translate-x-1 transition-transform"
          >
            {showAll ? '收合房型' : '展開更多房型'}
            <ChevronRight size={20} className={showAll ? 'rotate-90' : ''} />
          </button>
        </div>

        {dateFilter.checkIn && dateFilter.checkOut && filteredRooms.length === 0 && (
          <div className="bg-white border border-dashed border-slate-200 rounded-[2rem] p-10 text-center mb-8">
            <p className="text-slate-500 font-bold">此日期區間暫無可訂房型，請重新選擇日期。</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col"
            >
              <div className="h-64 bg-slate-100 relative overflow-hidden">
                {room.imageUrl ? (
                  <img
                    src={room.imageUrl}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-6xl">
                    {room.icon || '🏠'}
                  </div>
                )}

                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-sm">
                  <span className="text-blue-700 font-black text-lg">NT$ {room.price}</span>
                  <span className="text-slate-400 text-xs font-bold ml-1">/ 晚</span>
                </div>

                <div className="absolute top-4 right-4">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-black ${
                      (room.status || '開放') === '開放'
                        ? 'bg-emerald-100 text-emerald-700'
                        : (room.status || '開放') === '維護'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {room.status || '開放'}
                  </span>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                    {room.name}
                  </h3>
                </div>

                <p className="text-slate-500 leading-relaxed mb-6 line-clamp-3 text-sm font-medium">
                  {room.description}
                </p>

                <div className="mb-5 flex flex-wrap gap-2">
                  {(room.amenities || ['免費 WiFi']).map((item, index) => (
                    <span
                      key={`${room.id}-amenity-${index}`}
                      className="bg-slate-50 text-slate-500 text-xs font-bold px-3 py-1.5 rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mb-6">
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-black ${
                      room.availableCount > 0
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    <DoorOpen size={16} />
                    剩餘空房 {room.availableCount} 間
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-50 px-3 py-1.5 rounded-full">
                      <Users size={14} /> {room.capacity} 人
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-50 px-3 py-1.5 rounded-full">
                      <Wifi size={14} /> 免費 WiFi
                    </span>
                  </div>

                  <button
                    onClick={() => setView('booking')}
                    disabled={room.availableCount <= 0}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      room.availableCount > 0
                        ? 'bg-slate-900 text-white hover:bg-blue-600 hover:scale-110'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatsDashboard({ stats, role }) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 mb-2">首頁統計看板</h2>
        <p className="text-slate-500 font-medium">快速掌握民宿房型、可訂狀態與訂單資訊</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-5">
        <StatCard icon={<BedDouble size={20} />} label="房型總數" value={stats.roomTypeCount} color="blue" />
        <StatCard icon={<DoorOpen size={20} />} label="可訂房型數" value={stats.bookableCount} color="emerald" />
        <StatCard icon={<ClipboardList size={20} />} label="訂單總數" value={stats.bookingCount} color="slate" />

        {role === 'admin' && (
          <>
            <StatCard icon={<CalendarCheck2 size={20} />} label="已預訂" value={stats.reservedCount} color="blue" />
            <StatCard icon={<BarChart3 size={20} />} label="已入住 / 退房" value={`${stats.checkedInCount} / ${stats.checkedOutCount}`} color="emerald" />
            <StatCard icon={<XCircle size={20} />} label="已取消" value={stats.cancelledCount} color="rose" />
          </>
        )}
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500 font-bold mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

// --- 訂房頁 ---
function BookingFormView({ roomTypes, checkAvailability, toast, setView, initialRoomId, clearPreSelected }) {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    roomTypeId: initialRoomId || '',
    guestName: '',
    phone: '',
    checkInDate: '',
    checkOutDate: '',
    guests: 1,
    note: ''
  });

  useEffect(() => {
    if (initialRoomId) {
      setFormData((prev) => ({ ...prev, roomTypeId: initialRoomId }));
      clearPreSelected();
    }
  }, [initialRoomId, clearPreSelected]);

  const selectedRoom = roomTypes.find((r) => r.id === formData.roomTypeId);
  const availableCount =
    formData.roomTypeId && formData.checkInDate && formData.checkOutDate
      ? checkAvailability(formData.roomTypeId, formData.checkInDate, formData.checkOutDate)
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.roomTypeId) return toast("請先選擇房型", "error");
    if (!formData.guestName.trim()) return toast("請輸入住客姓名", "error");
    if (!/^09\d{8}$/.test(formData.phone.replace(/[^0-9]/g, ''))) return toast("電話格式不正確", "error");
    if (!formData.checkInDate || !formData.checkOutDate) return toast("請選擇入住與退房日期", "error");
    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) return toast("退房日期必須晚於入住日期", "error");
    if (!selectedRoom) return toast("請選擇有效房型", "error");
    if ((selectedRoom.status || '開放') !== '開放') return toast("此房型目前不可預訂", "error");
    if (Number(formData.guests) > Number(selectedRoom.capacity)) return toast("入住人數超過房型限制", "error");

    const remain = checkAvailability(formData.roomTypeId, formData.checkInDate, formData.checkOutDate);
    if (remain <= 0) return toast("該時段已無空房，已阻止重複訂房", "error");

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
        ...formData,
        guests: Number(formData.guests),
        roomTypeName: selectedRoom.name,
        status: '已預訂',
        createdAt: new Date().toISOString()
      });
      toast("訂房成功！");
      setView('my-bookings');
    } catch (err) {
      toast("訂房失敗", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-2">訂房流程</h2>
        <div className="flex flex-col md:flex-row md:items-center gap-3 text-sm font-bold text-slate-500">
          <span className="bg-slate-100 px-4 py-2 rounded-full">1. 選擇房型</span>
          <span>→</span>
          <span className="bg-slate-100 px-4 py-2 rounded-full">2. 輸入日期</span>
          <span>→</span>
          <span className="bg-slate-100 px-4 py-2 rounded-full">3. 填寫資料</span>
          <span>→</span>
          <span className="bg-slate-100 px-4 py-2 rounded-full">4. 系統檢查空房</span>
          <span>→</span>
          <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full">5. 完成訂房</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-4">
        <div className="bg-blue-600 p-10 text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black mb-2">立即預訂假期</h2>
            <p className="opacity-80 font-medium">填寫下方資訊，開啟您的輕旅行</p>
          </div>
          <div className="hidden sm:block bg-white/20 p-4 rounded-3xl backdrop-blur">
            <Calendar size={40} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-2">
            <label className="block text-sm font-black text-slate-700 mb-3">選擇夢想房型</label>
            <select
              required
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold transition-all appearance-none cursor-pointer"
              value={formData.roomTypeId}
              onChange={(e) => setFormData({ ...formData, roomTypeId: e.target.value })}
            >
              <option value="">請點擊展開選擇房型...</option>
              {roomTypes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — NT$ {r.price} (上限 {r.capacity} 人 / 狀態 {r.status || '開放'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">入住日期</label>
            <input
              type="date"
              required
              min={today}
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.checkInDate}
              onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">退房日期</label>
            <input
              type="date"
              required
              min={formData.checkInDate || today}
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">住客姓名</label>
            <input
              type="text"
              required
              placeholder="請輸入姓名"
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">聯絡電話</label>
            <input
              type="tel"
              required
              placeholder="09xxxxxxxx"
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">入住人數</label>
            <input
              type="number"
              min="1"
              max={selectedRoom?.capacity || 10}
              required
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.guests}
              onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-slate-700 mb-3">備註</label>
            <input
              type="text"
              placeholder="特殊需求可填寫"
              className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
              <h3 className="font-black text-slate-900 mb-3">系統檢查結果</h3>

              {!selectedRoom && <p className="text-slate-500 font-medium">請先選擇房型。</p>}

              {selectedRoom && (
                <div className="space-y-2 text-sm font-bold">
                  <p>房型：<span className="text-slate-900">{selectedRoom.name}</span></p>
                  <p>人數上限：<span className="text-slate-900">{selectedRoom.capacity} 人</span></p>
                  <p>房型狀態：<span className="text-slate-900">{selectedRoom.status || '開放'}</span></p>
                  {availableCount !== null && (
                    <p>
                      剩餘空房：
                      <span className={availableCount > 0 ? 'text-blue-600' : 'text-rose-600'}>
                        {' '}{availableCount} 間
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="md:col-span-2 w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 text-xl"
          >
            確認預訂房型
          </button>
        </form>
      </div>
    </div>
  );
}

// --- 訂單管理 ---
function OrderListView({ bookings, toast, role, onRebook }) {
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('upcoming');
  const today = new Date().toISOString().split('T')[0];

  const filtered = bookings.filter((b) => {
    const name = (b.guestName || '').toLowerCase();
    const roomName = (b.roomTypeName || '').toLowerCase();
    const keyword = filter.toLowerCase();
    const isMatch = name.includes(keyword) || roomName.includes(keyword);
    if (!isMatch) return false;

    if (tab === 'upcoming') {
      return b.status === '已預訂' && b.checkInDate >= today;
    }
    return b.status !== '已預訂' || b.checkInDate < today;
  });

  const updateStatus = async (id, status) => {
    if (!window.confirm(`確定將狀態更改為「${status}」？`)) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status });
      toast("狀態已更新");
    } catch (err) {
      toast("更新失敗", "error");
    }
  };

  const cancelBooking = async (id) => {
    if (!window.confirm("確定要取消這筆預訂嗎？此操作無法恢復。")) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status: '已取消' });
      toast("預訂已成功取消");
    } catch (err) {
      toast("操作失敗", "error");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900">
            {role === 'admin' ? '全館訂單管理' : '我的行程規劃'}
          </h2>
          <p className="text-slate-500 font-medium">管理您的預訂詳情與歷史紀錄</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋住客或房型..."
            className="pl-11 pr-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 w-full font-bold"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="flex p-1 bg-slate-200 rounded-2xl w-fit">
        <button
          onClick={() => setTab('upcoming')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${
            tab === 'upcoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          即將到來
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${
            tab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          歷史紀錄
        </button>
      </div>

      <div className="grid gap-6">
        {filtered.length === 0 ? (
          <div className="bg-white p-20 rounded-[2rem] text-center border border-dashed border-slate-200">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <ClipboardList size={40} />
            </div>
            <p className="text-slate-400 font-bold">目前暫無相關訂單資料</p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between gap-6 hover:shadow-lg transition-all border-l-8 border-l-blue-500"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">訂房人資訊</p>
                  <p className="text-lg font-black text-slate-900">{order.guestName}</p>
                  <p className="text-sm font-bold text-slate-500">{order.phone}</p>
                </div>

                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">入住詳情</p>
                  <p className="text-lg font-black text-blue-600">{order.roomTypeName}</p>
                  <p className="text-sm font-bold text-slate-500">{order.checkInDate} → {order.checkOutDate}</p>
                </div>

                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">狀態</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-4 py-1.5 rounded-full text-xs font-black ${
                        order.status === '已預訂'
                          ? 'bg-blue-100 text-blue-700'
                          : order.status === '已取消'
                            ? 'bg-rose-100 text-rose-700'
                            : order.status === '已入住'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {role === 'admin' ? (
                  <select
                    className="bg-slate-100 px-4 py-3 rounded-xl font-black text-sm outline-none cursor-pointer"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                  >
                    <option value="已預訂">已預訂</option>
                    <option value="已入住">已入住</option>
                    <option value="已退房">已退房</option>
                    <option value="已取消">已取消</option>
                  </select>
                ) : (
                  <>
                    {tab === 'upcoming' && (
                      <button
                        onClick={() => cancelBooking(order.id)}
                        className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                      >
                        <XCircle size={18} /> 取消預訂
                      </button>
                    )}
                    {tab === 'history' && (
                      <button
                        onClick={() => onRebook(order.roomTypeId)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-blue-100"
                      >
                        <RefreshCw size={18} /> 再次預訂
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- 後台房型管理 ---
function AdminRoomTypes({ roomTypes, toast }) {
  const emptyForm = {
    name: '',
    price: '',
    capacity: 2,
    totalRooms: 5,
    description: '',
    imageUrl: '',
    amenities: '免費 WiFi',
    status: '開放'
  };

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState(emptyForm);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId('');
    setIsAdding(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      price: parseInt(formData.price, 10),
      capacity: parseInt(formData.capacity, 10),
      totalRooms: parseInt(formData.totalRooms, 10),
      amenities: formData.amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'roomTypes', editingId),
          payload
        );
        toast("房型修改成功");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'roomTypes'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        toast("房型新增成功");
      }
      resetForm();
    } catch (err) {
      toast("保存失敗", "error");
    }
  };

  const handleEdit = (room) => {
    setIsAdding(true);
    setEditingId(room.id);
    setFormData({
      name: room.name || '',
      price: room.price || '',
      capacity: room.capacity || 2,
      totalRooms: room.totalRooms || 5,
      description: room.description || '',
      imageUrl: room.imageUrl || '',
      amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : '免費 WiFi',
      status: room.status || '開放'
    });
  };

  const deleteRoom = async (id) => {
    if (!window.confirm("確定刪除此房型？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roomTypes', id));
      toast("房型已移除");
    } catch (err) {
      toast("刪除失敗", "error");
    }
  };

  const updateRoomStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roomTypes', id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      toast("房型狀態已更新");
    } catch (err) {
      toast("狀態更新失敗", "error");
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black">後台管理系統</h2>
          <p className="text-slate-400 font-bold text-sm">房型管理、房間狀態管理、訂單管理與密碼設定</p>
        </div>
        <button
          onClick={() => {
            if (isAdding) {
              resetForm();
            } else {
              setIsAdding(true);
            }
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-900 transition-all"
        >
          <Plus size={20} /> {isAdding ? '取消編輯' : '新增房型'}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleSave}
          className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4"
        >
          <input
            type="text"
            placeholder="房型名稱"
            required
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="每晚價格"
            required
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
          <input
            type="number"
            placeholder="入住人數上限"
            required
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
          />
          <input
            type="number"
            placeholder="房間總數量"
            required
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.totalRooms}
            onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
          />
          <select
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            {ROOM_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="設備（用逗號分隔，如：免費 WiFi, 早餐, 海景陽台）"
            className="bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.amenities}
            onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
          />
          <input
            type="text"
            placeholder="圖片連結 URL（選填）"
            className="md:col-span-2 bg-slate-50 p-4 rounded-xl font-bold outline-none"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          />
          <textarea
            placeholder="特色說明..."
            required
            className="md:col-span-2 bg-slate-50 p-4 rounded-xl font-bold h-32 outline-none"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <button
            type="submit"
            className="md:col-span-2 bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save size={18} /> {editingId ? '更新房型' : '保存房型設定'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {roomTypes.length === 0 && (
          <p className="text-slate-400 font-bold col-span-2 text-center py-10">
            目前尚無自定義房型，系統正使用預設推薦資料。
          </p>
        )}

        {roomTypes.map((room) => (
          <div
            key={room.id}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 flex gap-6 items-start hover:shadow-md transition-shadow"
          >
            <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl overflow-hidden shrink-0">
              {room.imageUrl ? (
                <img src={room.imageUrl} className="w-full h-full object-cover" alt={room.name} />
              ) : (
                '🏠'
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black mb-1">{room.name}</h4>
                  <p className="text-sm font-bold text-slate-400">
                    NT$ {room.price} | 上限 {room.capacity} 人 | {room.totalRooms} 間房
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black ${
                    (room.status || '開放') === '開放'
                      ? 'bg-emerald-100 text-emerald-700'
                      : (room.status || '開放') === '維護'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {room.status || '開放'}
                </span>
              </div>

              <p className="text-sm text-slate-500 font-medium line-clamp-2">{room.description}</p>

              <div className="flex flex-wrap gap-2">
                {(room.amenities || ['免費 WiFi']).map((item, idx) => (
                  <span
                    key={`${room.id}-tag-${idx}`}
                    className="bg-slate-50 text-slate-500 text-xs font-bold px-3 py-1 rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <select
                  className="bg-slate-100 px-3 py-2 rounded-xl font-black text-sm outline-none cursor-pointer"
                  value={room.status || '開放'}
                  onChange={(e) => updateRoomStatus(room.id, e.target.value)}
                >
                  {ROOM_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleEdit(room)}
                  className="text-blue-600 bg-blue-50 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-blue-100"
                >
                  <Pencil size={16} /> 修改
                </button>

                <button
                  onClick={() => deleteRoom(room.id)}
                  className="text-rose-500 bg-rose-50 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-rose-100"
                >
                  <Trash2 size={16} /> 刪除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 系統設定 ---
function AdminSettings({ settings, toast }) {
  const [newPw, setNewPw] = useState('');

  return (
    <div className="max-w-xl mx-auto space-y-8 text-center py-20 animate-in zoom-in-95">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <Settings size={60} className="mx-auto text-blue-600 mb-6" />
        <h2 className="text-2xl font-black mb-2">密碼設定</h2>
        <p className="text-slate-500 font-medium mb-6">目前管理員密碼已啟用，可在此更新安全設定</p>

        <input
          type="text"
          placeholder="輸入新密碼"
          className="w-full bg-slate-50 p-4 rounded-xl font-bold mb-4 outline-none focus:ring-2 focus:ring-blue-600"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />

        <button
          onClick={async () => {
            if (!newPw) return toast("請輸入有效密碼", "error");
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), {
              adminPassword: newPw
            });
            toast("管理密碼已更新");
            setNewPw('');
          }}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-black"
        >
          更新安全設定
        </button>
      </div>
    </div>
  );
}

// --- 小型元件 ---
function NavTab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function MobileNav({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? 'text-blue-600 scale-110' : 'text-slate-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-black">{label}</span>
    </button>
  );
}
