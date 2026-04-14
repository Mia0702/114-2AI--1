import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  addDoc, updateDoc, deleteDoc, query, onSnapshot, orderBy 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Home, Calendar, ClipboardList, Settings, LogOut, 
  Plus, Edit2, Trash2, ChevronRight, Users, Info, AlertTriangle, CheckCircle, MapPin, Coffee, Wifi, Wind, RefreshCw, XCircle
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
  { id: 'f1', name: '雲端山景雙人房', price: 3200, capacity: 2, totalRooms: 5, description: '坐擁 180 度大面採光落地窗，清晨醒來即可見雲海繚繞，享受最純淨的山林氣息。', icon: '🏔️' },
  { id: 'f2', name: '蔚藍海岸大床房', price: 3800, capacity: 2, totalRooms: 3, description: '特選頂級獨立筒床墊，陽台可遠眺太平洋海岸線，聆聽海浪拍打礁石的自然協奏曲。', icon: '🌊' },
  { id: 'f3', name: '森呼吸家族套房', price: 5600, capacity: 4, totalRooms: 2, description: '寬敞的四人空間，室內採原木設計，適合全家大小共同體驗森林芬多精的洗禮。', icon: '🌲' },
  { id: 'f4', name: '星空觀測閣樓房', price: 4200, capacity: 2, totalRooms: 2, description: '獨特斜頂設計搭配電動天窗，躺在床上就能與另一半細數繁星，共度浪漫夜晚。', icon: '✨' },
  { id: 'f5', name: '日式禪風景觀房', price: 4500, capacity: 3, totalRooms: 3, description: '榻榻米空間搭配手工檜木桶浴缸，在簡約禪意的氛圍中洗滌心靈的疲憊。', icon: '🍵' }
];

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

  // 合併「預設房型」與「資料庫自訂房型」
  // 順序：先預設，再自訂；如果 id 相同，資料庫版本會覆蓋預設版本
const effectiveRoomTypes = useMemo(() => {
  const map = new Map();

  FEATURED_ROOMS.forEach((room) => {
    map.set(room.id, room);
  });

  roomTypes.forEach((room) => {
    map.set(room.id, room);
  });

  return Array.from(map.values());
}, [roomTypes]);

  // 初始化 Auth 與資料監聽
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInAnonymously(auth); 
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qRooms = collection(db, 'artifacts', appId, 'public', 'data', 'roomTypes');
    const unsubRooms = onSnapshot(qRooms, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoomTypes(roomsData);
      setLoading(false);
    }, (err) => console.error(err));

    const qBookings = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      bookingsData.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
      setBookings(bookingsData);
    }, (err) => console.error(err));

    const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
    const unsubSettings = onSnapshot(settingsDoc, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setDoc(settingsDoc, { adminPassword: '1234' });
      }
    }, (err) => console.error(err));

    return () => { unsubRooms(); unsubBookings(); unsubSettings(); };
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
    const selectedRoomType = effectiveRoomTypes.find(r => r.id === roomTypeId);
    if (!selectedRoomType) return 0;
    const totalRooms = parseInt(selectedRoomType.totalRooms || 0);
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const overlapping = bookings.filter(b => {
      if (b.roomTypeId !== roomTypeId || b.status === '已取消') return false;
      if (bookingId && b.id === bookingId) return false;
      return start < new Date(b.checkOutDate) && end > new Date(b.checkInDate);
    });
    return totalRooms - overlapping.length;
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
        <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 ${
          message.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
        }`}>
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
              <button onClick={handleLogout} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors">
                <LogOut size={16} /> 登出
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-10">
        {view === 'home' && <HomeView roomTypes={effectiveRoomTypes} bookings={bookings} setView={setView} />}
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
        {view === 'my-bookings' && <OrderListView bookings={bookings} toast={toast} role="guest" onRebook={handleRebook} />}
        {role === 'admin' && (
          <>
            {view === 'admin-rooms' && <AdminRoomTypes roomTypes={roomTypes} toast={toast} />}
            {view === 'admin-bookings' && <OrderListView bookings={bookings} toast={toast} role="admin" onRebook={handleRebook} />}
            {view === 'admin-settings' && <AdminSettings settings={settings} toast={toast} />}
          </>
        )}
      </main>

      {/* 手機版下方導航 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-3 px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <MobileNav active={view === 'home'} onClick={() => setView('home')} icon={<Home size={20}/>} label="首頁" />
        <MobileNav active={view === 'booking'} onClick={() => setView('booking')} icon={<Calendar size={20}/>} label="訂房" />
        <MobileNav active={view === 'my-bookings'} onClick={() => setView('my-bookings')} icon={<ClipboardList size={20}/>} label="訂單" />
        {role === 'admin' && <MobileNav active={view.startsWith('admin')} onClick={() => setView('admin-rooms')} icon={<Settings size={20}/>} label="後台" />}
      </div>
    </div>
  );
}

// --- 視圖組件 ---

function HomeView({ roomTypes, bookings, setView }) {
  const [showAll, setShowAll] = useState(false);
  const displayRooms = showAll ? roomTypes : roomTypes.slice(0, 3);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
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
            {showAll ? '收合房型' : '展開更多房型'} <ChevronRight size={20} className={showAll ? 'rotate-90' : ''}/>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayRooms.map((room) => (
            <div key={room.id} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col">
              <div className="h-64 bg-slate-100 relative overflow-hidden">
                {room.imageUrl ? (
                  <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-6xl">
                    {room.icon || '🏠'}
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-sm">
                  <span className="text-blue-700 font-black text-lg">NT$ {room.price}</span>
                  <span className="text-slate-400 text-xs font-bold ml-1">/ 晚</span>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">{room.name}</h3>
                <p className="text-slate-500 leading-relaxed mb-6 line-clamp-3 text-sm font-medium">{room.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-50 px-3 py-1.5 rounded-full">
                      <Users size={14}/> {room.capacity} 人
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-50 px-3 py-1.5 rounded-full">
                      <Wifi size={14}/> 免費 WiFi
                    </span>
                  </div>
                  <button onClick={() => setView('booking')} className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition-all">
                    <Plus size={20}/>
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

function BookingFormView({ roomTypes, checkAvailability, toast, setView, initialRoomId, clearPreSelected }) {
  const [formData, setFormData] = useState({ roomTypeId: initialRoomId || '', guestName: '', phone: '', checkInDate: '', checkOutDate: '', guests: 1, note: '' });

  useEffect(() => {
    if (initialRoomId) {
      setFormData(prev => ({ ...prev, roomTypeId: initialRoomId }));
      clearPreSelected();
    }
  }, [initialRoomId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) return toast("日期選擇有誤", "error");
    const room = roomTypes.find(r => r.id === formData.roomTypeId);
    if (!room) return toast("請選擇有效房型", "error");
    if (formData.guests > room.capacity) return toast("人數超過房型限制", "error");
    
    const availableCount = checkAvailability(formData.roomTypeId, formData.checkInDate, formData.checkOutDate);
    if (availableCount <= 0) return toast("該時段已無空房", "error");

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), { 
        ...formData, 
        roomTypeName: room.name, 
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
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-4">
      <div className="bg-blue-600 p-10 text-white flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black mb-2">立即預訂假期</h2>
          <p className="opacity-80 font-medium">填寫下方資訊，開啟您的輕旅行</p>
        </div>
        <div className="hidden sm:block bg-white/20 p-4 rounded-3xl backdrop-blur"><Calendar size={40}/></div>
      </div>
      <form onSubmit={handleSubmit} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-2">
          <label className="block text-sm font-black text-slate-700 mb-3">選擇夢想房型</label>
          <select 
            required 
            className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold transition-all appearance-none cursor-pointer" 
            value={formData.roomTypeId} 
            onChange={e => setFormData({...formData, roomTypeId: e.target.value})}
          >
            <option value="">請點擊展開選擇房型...</option>
            {roomTypes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} — NT$ {r.price} (上限 {r.capacity}人)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-black text-slate-700 mb-3">入住日期</label>
          <input type="date" required min={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold" value={formData.checkInDate} onChange={e => setFormData({...formData, checkInDate: e.target.value})}/>
        </div>
        <div>
          <label className="block text-sm font-black text-slate-700 mb-3">退房日期</label>
          <input type="date" required min={formData.checkInDate || new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold" value={formData.checkOutDate} onChange={e => setFormData({...formData, checkOutDate: e.target.value})}/>
        </div>
        <div>
          <label className="block text-sm font-black text-slate-700 mb-3">住客姓名</label>
          <input type="text" required placeholder="請輸入姓名" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold" value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})}/>
        </div>
        <div>
          <label className="block text-sm font-black text-slate-700 mb-3">聯絡電話</label>
          <input type="tel" required placeholder="09xx-xxx-xxx" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/>
        </div>
        <button type="submit" className="md:col-span-2 w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 text-xl">確認預訂房型</button>
      </form>
    </div>
  );
}

function OrderListView({ bookings, toast, role, onRebook }) {
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('upcoming'); // upcoming or history
  
  const today = new Date().toISOString().split('T')[0];

  const filtered = bookings.filter(b => {
    const isNameMatch = b.guestName.toLowerCase().includes(filter.toLowerCase()) || b.roomTypeName.toLowerCase().includes(filter.toLowerCase());
    if (!isNameMatch) return false;
    
    if (tab === 'upcoming') {
      return b.status === '已預訂' && b.checkInDate >= today;
    } else {
      return b.status !== '已預訂' || b.checkInDate < today;
    }
  });

  const updateStatus = async (id, status) => {
    if(!window.confirm(`確定將狀態更改為「${status}」？`)) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), { status });
      toast("狀態已更新");
    } catch (err) {
      toast("更新失敗", "error");
    }
  };

  const cancelBooking = async (id) => {
    if(!window.confirm("確定要取消這筆預訂嗎？此操作無法恢復。")) return;
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
          <h2 className="text-3xl font-black text-slate-900">{role === 'admin' ? '全館訂單管理' : '我的行程規劃'}</h2>
          <p className="text-slate-500 font-medium">管理您的預訂詳情與歷史紀錄</p>
        </div>
        <input type="text" placeholder="搜尋住客或房型..." className="px-6 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80 font-bold" value={filter} onChange={e => setFilter(e.target.value)}/>
      </div>

      <div className="flex p-1 bg-slate-200 rounded-2xl w-fit">
        <button onClick={() => setTab('upcoming')} className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${tab === 'upcoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>即將到來</button>
        <button onClick={() => setTab('history')} className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${tab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>歷史紀錄</button>
      </div>

      <div className="grid gap-6">
        {filtered.length === 0 ? (
          <div className="bg-white p-20 rounded-[2rem] text-center border border-dashed border-slate-200">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <ClipboardList size={40}/>
            </div>
            <p className="text-slate-400 font-bold">目前暫無相關訂單資料</p>
          </div>
        ) : (
          filtered.map(order => (
            <div key={order.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between gap-6 hover:shadow-lg transition-all border-l-8 border-l-blue-500">
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
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black ${
                      order.status === '已預訂' ? 'bg-blue-100 text-blue-700' :
                      order.status === '已取消' ? 'bg-rose-100 text-rose-700' : 
                      order.status === '已入住' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>{order.status}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {role === 'admin' ? (
                  <select className="bg-slate-100 px-4 py-3 rounded-xl font-black text-sm outline-none cursor-pointer" value={order.status} onChange={e => updateStatus(order.id, e.target.value)}>
                    <option value="已預訂">已預訂</option><option value="已入住">已入住</option><option value="已退房">已退房</option><option value="已取消">已取消</option>
                  </select>
                ) : (
                  <>
                    {tab === 'upcoming' && (
                      <button 
                        onClick={() => cancelBooking(order.id)} 
                        className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                      >
                        <XCircle size={18}/> 取消預訂
                      </button>
                    )}
                    {tab === 'history' && (
                      <button 
                        onClick={() => onRebook(order.roomTypeId)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-blue-100"
                      >
                        <RefreshCw size={18}/> 再次預訂
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

function AdminRoomTypes({ roomTypes, toast }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', capacity: 2, totalRooms: 5, description: '', imageUrl: '' });

  const handleSave = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'roomTypes'), { 
      ...formData, 
      price: parseInt(formData.price), 
      capacity: parseInt(formData.capacity), 
      totalRooms: parseInt(formData.totalRooms), 
      createdAt: new Date().toISOString() 
    });
    toast("房型新增成功"); 
    setIsAdding(false);
    setFormData({ name: '', price: '', capacity: 2, totalRooms: 5, description: '', imageUrl: '' });
  };

  const deleteRoom = async (id) => {
    if(!window.confirm("確定刪除此房型？")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roomTypes', id));
    toast("房型已移除");
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black">房型資產管理</h2>
          <p className="text-slate-400 font-bold text-sm">此處管理的房型將會覆蓋預設推薦房型</p>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-900 transition-all">
          <Plus size={20}/> {isAdding ? '取消新增' : '新增房型'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4">
          <input type="text" placeholder="房型名稱 (如: 頂級海景房)" required className="bg-slate-50 p-4 rounded-xl font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/>
          <input type="number" placeholder="每晚價格" required className="bg-slate-50 p-4 rounded-xl font-bold" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})}/>
          <input type="number" placeholder="入住人數上限" required className="bg-slate-50 p-4 rounded-xl font-bold" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})}/>
          <input type="number" placeholder="房間總數量" required className="bg-slate-50 p-4 rounded-xl font-bold" value={formData.totalRooms} onChange={e => setFormData({...formData, totalRooms: e.target.value})}/>
          <input type="text" placeholder="圖片連結 URL (選填)" className="md:col-span-2 bg-slate-50 p-4 rounded-xl font-bold" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})}/>
          <textarea placeholder="特色說明..." required className="md:col-span-2 bg-slate-50 p-4 rounded-xl font-bold h-32" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/>
          <button type="submit" className="md:col-span-2 bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700">保存房型設定</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {roomTypes.length === 0 && <p className="text-slate-400 font-bold col-span-2 text-center py-10">目前尚無自定義房型，系統正使用預設推薦資料。</p>}
        {roomTypes.map(room => (
          <div key={room.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex gap-6 items-center hover:shadow-md transition-shadow">
            <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl overflow-hidden shrink-0">
              {room.imageUrl ? <img src={room.imageUrl} className="w-full h-full object-cover" alt={room.name}/> : '🏠'}
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-black mb-1">{room.name}</h4>
              <p className="text-sm font-bold text-slate-400">NT$ {room.price} | 上限 {room.capacity} 人 | {room.totalRooms} 間房</p>
            </div>
            <button onClick={() => deleteRoom(room.id)} className="text-rose-500 p-3 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={24}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSettings({ settings, toast }) {
  const [newPw, setNewPw] = useState('');
  return (
    <div className="max-w-xl mx-auto space-y-8 text-center py-20 animate-in zoom-in-95">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <Settings size={60} className="mx-auto text-blue-600 mb-6"/>
        <h2 className="text-2xl font-black mb-6">修改管理系統密碼</h2>
        <input type="text" placeholder="輸入新密碼" className="w-full bg-slate-50 p-4 rounded-xl font-bold mb-4 outline-none focus:ring-2 focus:ring-blue-600" value={newPw} onChange={e => setNewPw(e.target.value)}/>
        <button onClick={async () => { 
          if(!newPw) return toast("請輸入有效密碼", "error");
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), { adminPassword: newPw }); 
          toast("管理密碼已更新"); 
          setNewPw(''); 
        }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black">更新安全設定</button>
      </div>
    </div>
  );
}

// --- 小型輔助組件 ---

function NavTab({ active, onClick, label }) {
  return (
    <button onClick={onClick} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
      {label}
    </button>
  );
}

function MobileNav({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-600 scale-110' : 'text-slate-400'}`}>
      {icon} <span className="text-[10px] font-black">{label}</span>
    </button>
  );
}
