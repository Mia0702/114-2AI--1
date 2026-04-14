import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  setDoc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Home, 
  Calendar, 
  User, 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  Lock,
  Menu,
  X,
  ChevronRight,
  Loader2,
  Info
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wang-wang-minshuku';

// --- Helper Functions ---
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-TW');
};

const isDateOverlap = (startA, endA, startB, endB) => {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
};

// --- Components ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(localStorage.getItem('userRole') || 'guest');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isAdminLoggedIn') === 'true');
  const [view, setView] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data State
  const [roomTypes, setRoomTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ adminPassword: '1234' });

  // UI State
  const [modal, setModal] = useState({ show: false, type: '', data: null });
  const [message, setMessage] = useState({ text: '', type: '' });

  // 1. Auth & Initial Load
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Data Listeners & Fixed Room Initialization
  useEffect(() => {
    if (!user) return;

    const pathPrefix = ['artifacts', appId, 'public', 'data'];
    
    // Room Types Listener
    const qRoomTypes = collection(db, ...pathPrefix, 'roomTypes');
    const unsubRoomTypes = onSnapshot(qRoomTypes, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // --- Logic for Fixed/Locked Rooms ---
      // If the system is empty or missing specific core rooms, initialize them
      if (data.length === 0) {
        const defaultRooms = [
          { name: "汪汪豪華雙人房", price: 2800, capacity: 2, totalRooms: 5, description: "寬敞舒適的雙人空間，汪星人友善設計。", isFixed: true },
          { name: "汪汪溫馨四人房", price: 4200, capacity: 4, totalRooms: 3, description: "全家出遊的首選，充滿溫馨氛圍。", isFixed: true }
        ];
        for (const r of defaultRooms) {
          await addDoc(qRoomTypes, { ...r, createdAt: serverTimestamp() });
        }
      }
      
      setRoomTypes(data);
      setLoading(false);
    }, (err) => console.error(err));

    // Bookings Listener
    const qBookings = collection(db, ...pathPrefix, 'bookings');
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(data.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate)));
    }, (err) => console.error(err));

    // Settings Listener
    const docSettings = doc(db, ...pathPrefix, 'settings', 'admin');
    const unsubSettings = onSnapshot(docSettings, (docSnap) => {
      if (docSnap.exists()) {
        setAdminSettings(docSnap.data());
      } else {
        setDoc(docSettings, { adminPassword: '1234' });
      }
    });

    return () => {
      unsubRoomTypes();
      unsubBookings();
      unsubSettings();
    };
  }, [user]);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const checkAvailability = (roomTypeId, checkIn, checkOut, excludeBookingId = null) => {
    const selectedRoomType = roomTypes.find(rt => rt.id === roomTypeId);
    if (!selectedRoomType) return 0;
    const totalRooms = parseInt(selectedRoomType.totalRooms) || 0;
    const overlappingBookings = bookings.filter(b => {
      if (b.status === '已取消') return false;
      if (b.roomTypeId !== roomTypeId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      return isDateOverlap(checkIn, checkOut, b.checkInDate, b.checkOutDate);
    });
    return Math.max(0, totalRooms - overlappingBookings.length);
  };

  const handleAdminLogin = (pw) => {
    if (pw === adminSettings.adminPassword) {
      setIsLoggedIn(true);
      setRole('admin');
      localStorage.setItem('isAdminLoggedIn', 'true');
      localStorage.setItem('userRole', 'admin');
      showToast('管理員登入成功');
      setModal({ show: false, type: '', data: null }); // Successfully login, auto close modal
      setView('adminPanel');
    } else {
      showToast('密碼錯誤', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole('guest');
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.setItem('userRole', 'guest');
    setView('home');
    showToast('已登出系統');
  };

  const createBooking = async (formData) => {
    const available = checkAvailability(formData.roomTypeId, formData.checkInDate, formData.checkOutDate);
    if (available <= 0) {
      showToast('此日期區間已無空房，請重新選擇', 'error');
      return;
    }
    try {
      const path = ['artifacts', appId, 'public', 'data', 'bookings'];
      const roomType = roomTypes.find(rt => rt.id === formData.roomTypeId);
      await addDoc(collection(db, ...path), {
        ...formData,
        roomTypeName: roomType.name,
        status: '已預訂',
        createdAt: serverTimestamp()
      });
      showToast('訂房成功！');
      setModal({ show: false, type: '', data: null });
    } catch (err) {
      showToast('訂房失敗，請稍後再試', 'error');
    }
  };

  const updateBookingStatus = async (id, status) => {
    try {
      const path = ['artifacts', appId, 'public', 'data', 'bookings', id];
      await updateDoc(doc(db, ...path), { status });
      showToast(`訂單狀態已更新為: ${status}`);
    } catch (err) {
      showToast('更新失敗', 'error');
    }
  };

  const deleteBooking = async (id) => {
    if (!window.confirm('確定要刪除此訂單記錄嗎？')) return;
    try {
      const path = ['artifacts', appId, 'public', 'data', 'bookings', id];
      await deleteDoc(doc(db, ...path));
      showToast('訂單已永久刪除');
    } catch (err) {
      showToast('刪除失敗', 'error');
    }
  };

  const saveRoomType = async (formData) => {
    try {
      const path = ['artifacts', appId, 'public', 'data', 'roomTypes'];
      if (formData.id) {
        await updateDoc(doc(db, ...path, formData.id), formData);
        showToast('房型更新成功');
      } else {
        await addDoc(collection(db, ...path), { ...formData, createdAt: serverTimestamp() });
        showToast('房型新增成功');
      }
      setModal({ show: false, type: '', data: null });
    } catch (err) {
      showToast('儲存失敗', 'error');
    }
  };

  const deleteRoomType = async (id) => {
    const room = roomTypes.find(r => r.id === id);
    if (room?.isFixed) {
      showToast('此為系統固定房型，不可刪除', 'error');
      return;
    }
    if (!window.confirm('確定要刪除此房型？')) return;
    try {
      const path = ['artifacts', appId, 'public', 'data', 'roomTypes', id];
      await deleteDoc(doc(db, ...path));
      showToast('房型已刪除');
    } catch (err) {
      showToast('刪除失敗', 'error');
    }
  };

  const updatePassword = async (newPw) => {
    try {
      const path = ['artifacts', appId, 'public', 'data', 'settings', 'admin'];
      await updateDoc(doc(db, ...path), { adminPassword: newPw });
      showToast('密碼修改成功');
      setModal({ show: false, type: '', data: null });
    } catch (err) {
      showToast('密碼修改失敗', 'error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-700">汪汪載入中...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      {message.text && (
        <div className={`fixed top-5 right-5 z-[100] px-6 py-3 rounded-lg shadow-xl text-white font-medium animate-bounce ${message.type === 'error' ? 'bg-red-500' : 'bg-orange-500'}`}>
          {message.text}
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
              <div className="bg-orange-500 p-2 rounded-lg text-white">
                <Home size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">汪汪民宿訂房系統</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-4">
              <button onClick={() => setView('home')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'home' ? 'text-orange-600' : 'text-slate-600 hover:text-orange-600'}`}>房型預訂</button>
              {role === 'guest' && (
                <button onClick={() => setView('myBookings')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'myBookings' ? 'text-orange-600' : 'text-slate-600 hover:text-orange-600'}`}>我的訂單</button>
              )}
              {role === 'admin' ? (
                <>
                  <button onClick={() => setView('adminPanel')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'adminPanel' ? 'text-orange-600' : 'text-slate-600 hover:text-orange-600'}`}>後台管理</button>
                  <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
                    <LogOut size={16} /> 登出
                  </button>
                </>
              ) : (
                <button onClick={() => setModal({ show: true, type: 'login' })} className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
                  <Lock size={16} /> 管理員登入
                </button>
              )}
            </div>

            <div className="md:hidden">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-600 hover:text-orange-600">
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-slate-800/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="fixed top-16 right-0 bottom-0 w-64 bg-white shadow-xl p-4 flex flex-col gap-4 animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setView('home'); setSidebarOpen(false); }} className="text-left py-3 border-b text-slate-700 font-medium">首頁</button>
            {role === 'guest' && (
              <button onClick={() => { setView('myBookings'); setSidebarOpen(false); }} className="text-left py-3 border-b text-slate-700 font-medium">我的訂單</button>
            )}
            {role === 'admin' ? (
              <>
                <button onClick={() => { setView('adminPanel'); setSidebarOpen(false); }} className="text-left py-3 border-b text-slate-700 font-medium">後台管理</button>
                <button onClick={handleLogout} className="text-left py-3 text-red-600 font-medium">登出</button>
              </>
            ) : (
              <button onClick={() => { setModal({ show: true, type: 'login' }); setSidebarOpen(false); }} className="text-left py-3 text-orange-600 font-medium">管理員登入</button>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="房型總數" value={roomTypes.length} icon={<Home size={20} />} color="bg-orange-500" />
          <StatCard label="訂單總數" value={bookings.length} icon={<Calendar size={20} />} color="bg-emerald-500" />
          {role === 'admin' && (
            <>
              <StatCard label="待處理" value={bookings.filter(b => b.status === '已預訂').length} icon={<Info size={20} />} color="bg-blue-500" />
              <StatCard label="今日入住" value={bookings.filter(b => b.checkInDate === new Date().toISOString().split('T')[0]).length} icon={<User size={20} />} color="bg-indigo-500" />
            </>
          )}
        </div>

        {view === 'home' && <HomeView roomTypes={roomTypes} checkAvailability={checkAvailability} onBook={(room) => setModal({ show: true, type: 'book', data: room })} />}
        {view === 'myBookings' && <MyBookingsView bookings={bookings} onCancel={(id) => updateBookingStatus(id, '已取消')} />}
        {view === 'adminPanel' && role === 'admin' && (
          <AdminPanel 
            roomTypes={roomTypes} 
            bookings={bookings} 
            onEditRoom={(room) => setModal({ show: true, type: 'roomForm', data: room })}
            onAddRoom={() => setModal({ show: true, type: 'roomForm', data: null })}
            onDeleteRoom={deleteRoomType}
            onUpdateBooking={updateBookingStatus}
            onDeleteBooking={deleteBooking}
            onChangePassword={() => setModal({ show: true, type: 'changePassword' })}
          />
        )}
      </main>

      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            {modal.type === 'login' && <LoginForm onLogin={handleAdminLogin} onClose={() => setModal({ show: false })} />}
            {modal.type === 'book' && <BookingForm roomType={modal.data} onClose={() => setModal({ show: false })} onSubmit={createBooking} checkAvailability={checkAvailability} />}
            {modal.type === 'roomForm' && <RoomTypeForm roomType={modal.data} onClose={() => setModal({ show: false })} onSubmit={saveRoomType} />}
            {modal.type === 'changePassword' && <ChangePasswordForm onClose={() => setModal({ show: false })} onSubmit={updatePassword} />}
          </div>
        </div>
      )}
    </div>
  );
}

// --- View Components ---

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
      <div className={`${color} p-3 rounded-lg text-white`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function HomeView({ roomTypes, checkAvailability, onBook }) {
  const [queryDate, setQueryDate] = useState({
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0]
  });

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1">
          <label className="text-sm font-semibold text-slate-700">入住日期</label>
          <input type="date" value={queryDate.checkIn} onChange={e => setQueryDate({...queryDate, checkIn: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div className="flex-1 w-full space-y-1">
          <label className="text-sm font-semibold text-slate-700">退房日期</label>
          <input type="date" value={queryDate.checkOut} onChange={e => setQueryDate({...queryDate, checkOut: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div className="w-full md:w-auto text-orange-600 bg-orange-50 px-4 py-2.5 rounded-lg text-sm font-medium border border-orange-100 flex items-center gap-2">
          <Calendar size={18} /> 正在預覽空房狀況
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roomTypes.map(room => {
          const availableCount = checkAvailability(room.id, queryDate.checkIn, queryDate.checkOut);
          return (
            <div key={room.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 hover:shadow-md transition-shadow group">
              <div className="relative h-48 bg-slate-200 overflow-hidden">
                <img src={room.imageUrl || `https://placehold.co/600x400/orange/white?text=${encodeURIComponent(room.name)}`} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-orange-700 font-bold shadow-sm">
                  ${room.price} / 晚
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold">{room.name}</h3>
                  {room.isFixed && <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded uppercase">固定房型</span>}
                </div>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                <div className="flex items-center gap-4 text-sm text-slate-600 mb-6">
                  <span className="flex items-center gap-1"><User size={16} /> 最多 {room.capacity} 人</span>
                  <span className={`flex items-center gap-1 font-semibold ${availableCount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <Home size={16} /> 剩餘 {availableCount} 間
                  </span>
                </div>
                <button 
                  disabled={availableCount <= 0}
                  onClick={() => onBook(room)}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${availableCount > 0 ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  {availableCount > 0 ? '立即預訂' : '目前已客滿'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {roomTypes.length === 0 && <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300 text-slate-400">尚無房型資料</div>}
    </div>
  );
}

function MyBookingsView({ bookings, onCancel }) {
  const [search, setSearch] = useState('');
  const filtered = bookings.filter(b => b.phone.includes(search) || b.guestName.includes(search));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-4">查詢訂單</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input 
            placeholder="輸入預訂人電話或姓名查詢..." 
            className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {search ? (
          filtered.map(b => <BookingCard key={b.id} booking={b} onCancel={onCancel} />)
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300 text-slate-400">請輸入資料查詢您的訂單紀錄</div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, onCancel, isAdmin, onUpdate, onDelete }) {
  const statusColors = {
    '已預訂': 'bg-blue-100 text-blue-700',
    '已入住': 'bg-amber-100 text-amber-700',
    '已退房': 'bg-emerald-100 text-emerald-700',
    '已取消': 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-orange-200 transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColors[booking.status]}`}>{booking.status}</span>
            <span className="text-xs text-slate-400">訂單 ID: {booking.id}</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800">{booking.roomTypeName}</h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1 font-medium"><Calendar size={14} /> {formatDate(booking.checkInDate)} ~ {formatDate(booking.checkOutDate)}</span>
            <span className="flex items-center gap-1"><User size={14} /> {booking.guestName} ({booking.guests} 人)</span>
            <span className="flex items-center gap-1 font-mono">{booking.phone}</span>
          </div>
          {booking.note && <p className="text-sm text-slate-500 mt-2 bg-slate-50 p-2 rounded italic">備註: {booking.note}</p>}
        </div>

        <div className="flex md:flex-col items-center justify-end gap-2">
          {!isAdmin && booking.status === '已預訂' && (
            <button onClick={() => onCancel(booking.id)} className="w-full md:w-32 py-2 px-4 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">取消預訂</button>
          )}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 justify-end">
              <select 
                value={booking.status} 
                onChange={(e) => onUpdate(booking.id, e.target.value)}
                className="p-2 border rounded-lg text-sm bg-slate-50 outline-none"
              >
                <option value="已預訂">已預訂</option>
                <option value="已入住">已入住</option>
                <option value="已退房">已退房</option>
                <option value="已取消">已取消</option>
              </select>
              <button onClick={() => onDelete(booking.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ roomTypes, bookings, onEditRoom, onAddRoom, onDeleteRoom, onUpdateBooking, onDeleteBooking, onChangePassword }) {
  const [tab, setTab] = useState('bookings');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex gap-4">
          <button onClick={() => setTab('bookings')} className={`pb-2 px-1 font-bold ${tab === 'bookings' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-slate-400'}`}>訂單管理</button>
          <button onClick={() => setTab('rooms')} className={`pb-2 px-1 font-bold ${tab === 'rooms' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-slate-400'}`}>房型管理</button>
        </div>
        <button onClick={onChangePassword} className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600">
          <Settings size={16} /> 修改後台密碼
        </button>
      </div>

      {tab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">所有預訂 ({bookings.length})</h2>
          </div>
          {bookings.map(b => (
            <BookingCard key={b.id} booking={b} isAdmin={true} onUpdate={onUpdateBooking} onDelete={onDeleteBooking} />
          ))}
        </div>
      )}

      {tab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">房型列表 ({roomTypes.length})</h2>
            <button onClick={onAddRoom} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 shadow-sm">
              <Plus size={18} /> 新增房型
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {roomTypes.map(room => (
              <div key={room.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={room.imageUrl || `https://placehold.co/100x100?text=${room.name[0]}`} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold">{room.name}</h4>
                      {room.isFixed && <span className="bg-slate-100 text-slate-400 text-[9px] px-1 py-0.5 rounded uppercase">固定</span>}
                    </div>
                    <p className="text-sm text-slate-500">${room.price} / 晚 · {room.capacity} 人 · 共 {room.totalRooms} 間房</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEditRoom(room)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"><Edit3 size={18} /></button>
                  <button 
                    onClick={() => onDeleteRoom(room.id)} 
                    className={`p-2 rounded-lg ${room.isFixed ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                    disabled={room.isFixed}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Form Components ---

function LoginForm({ onLogin, onClose }) {
  const [pw, setPw] = useState('');
  return (
    <div className="p-8">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">管理員登入</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">輸入管理密碼</label>
          <input 
            type="password" 
            placeholder="預設為 1234"
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onLogin(pw);
              }
            }}
            autoFocus
          />
        </div>
        <button onClick={() => onLogin(pw)} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700">登入後台</button>
      </div>
    </div>
  );
}

function BookingForm({ roomType, onClose, onSubmit, checkAvailability }) {
  const [formData, setFormData] = useState({
    guestName: '',
    phone: '',
    guests: 1,
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    note: '',
    roomTypeId: roomType.id
  });

  const available = checkAvailability(roomType.id, formData.checkInDate, formData.checkOutDate);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (new Date(formData.checkInDate) >= new Date(formData.checkOutDate)) {
      alert('退房日期必須晚於入住日期');
      return;
    }
    if (formData.guests > roomType.capacity) {
      alert(`此房型人數上限為 ${roomType.capacity} 人`);
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="p-8 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">預訂 {roomType.name}</h2>
          <p className="text-sm text-slate-500">請填寫下方資訊完成訂房</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">入住日期</label>
            <input required type="date" value={formData.checkInDate} onChange={e => setFormData({...formData, checkInDate: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">退房日期</label>
            <input required type="date" value={formData.checkOutDate} onChange={e => setFormData({...formData, checkOutDate: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
        </div>

        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${available > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          <Info size={16} /> 該區間剩餘空房: {available} 間
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-semibold mb-1">預訂人姓名</label>
            <input required type="text" value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-semibold mb-1">入住人數 (上限 {roomType.capacity})</label>
            <input required type="number" min="1" max={roomType.capacity} value={formData.guests} onChange={e => setFormData({...formData, guests: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">聯絡電話</label>
          <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" placeholder="如：0912345678" />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">特殊需求備註</label>
          <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none h-20" placeholder="可填寫預計抵達時間或特殊需求..."></textarea>
        </div>

        <button 
          type="submit" 
          disabled={available <= 0}
          className={`w-full py-4 rounded-xl font-bold shadow-lg shadow-orange-200 transition-all ${available > 0 ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-300 text-white cursor-not-allowed'}`}
        >
          {available > 0 ? `確認預訂 · $${roomType.price}` : '無法預訂 (無空房)'}
        </button>
      </form>
    </div>
  );
}

function RoomTypeForm({ roomType, onClose, onSubmit }) {
  const [formData, setFormData] = useState(roomType || {
    name: '',
    price: 2000,
    capacity: 2,
    totalRooms: 5,
    description: '',
    imageUrl: '',
    isFixed: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="p-8 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">{roomType ? '編輯房型' : '新增房型'}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">房型名稱</label>
          <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">價格 / 晚</label>
            <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">容納人數</label>
            <input required type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} className="w-full p-2.5 border rounded-lg outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">房間總量</label>
          <input required type="number" value={formData.totalRooms} onChange={e => setFormData({...formData, totalRooms: parseInt(e.target.value)})} className="w-full p-2.5 border rounded-lg outline-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">房型圖片網址</label>
          <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">房型描述</label>
          <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none h-24"></textarea>
        </div>
        <button type="submit" className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600">儲存資料</button>
      </form>
    </div>
  );
}

function ChangePasswordForm({ onClose, onSubmit }) {
  const [newPw, setNewPw] = useState('');
  return (
    <div className="p-8">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">修改後台密碼</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">輸入新密碼</label>
          <input 
            type="password" 
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
          />
        </div>
        <button onClick={() => onSubmit(newPw)} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700">確認修改</button>
      </div>
    </div>
  );
}

// --- CSS Animations ---
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
  .animate-scale-in { animation: scale-in 0.2s ease-out; }
`;
document.head.appendChild(style);
