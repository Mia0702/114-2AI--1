import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy
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
  LogOut, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Menu, 
  X,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Info
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "請替換",
  authDomain: "請替換",
  projectId: "請替換",
  storageBucket: "請替換",
  messagingSenderId: "請替換",
  appId: "請替換"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'bnb-system-v2';

const ROLES = { GUEST: 'guest', ADMIN: 'admin' };
const BOOKING_STATUS = {
  PENDING: '已預訂',
  CHECKED_IN: '已入住',
  CHECKED_OUT: '已退房',
  CANCELLED: '已取消'
};
const DEFAULT_ADMIN_PWD = "1234";

// --- 通用樣式組件 ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const base = "px-6 py-2.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
  };
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-sm font-bold text-gray-500 ml-1">{label}</label>}
    <input 
      className="px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      {...props}
    />
  </div>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(localStorage.getItem('bnb_role') || ROLES.GUEST);
  const [activeTab, setActiveTab] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState("");
  
  const [roomTypes, setRoomTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [adminPwd, setAdminPwd] = useState("");
  const [message, setMessage] = useState(null);

  // 初始化 Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Fail", err); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  // 監聽數據與初始化房型
  useEffect(() => {
    if (!user) return;
    const path = (col) => collection(db, 'artifacts', APP_ID, 'public', 'data', col);

    const unsubTypes = onSnapshot(path('roomTypes'), async (snap) => {
      if (snap.empty) {
        // 初始化一些漂亮的房型
        const defaultTypes = [
          { name: "精緻簡約雙人房", price: 2800, capacity: 2, totalRooms: 5, description: "現代簡約風格，配有舒適的大床與獨立衛浴，適合情侶或商務旅客。", imageUrl: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80", createdAt: new Date().toISOString() },
          { name: "海景豪華家庭房", price: 5600, capacity: 4, totalRooms: 3, description: "寬敞的兩大床配置，超大落地窗直面無敵海景，提供家庭旅遊最棒的享受。", imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80", createdAt: new Date().toISOString() },
          { name: "頂樓露台總統套房", price: 12000, capacity: 2, totalRooms: 1, description: "私人頂樓空間，配備露天大浴缸與私人休息區，給您極致奢華的住宿體驗。", imageUrl: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80", createdAt: new Date().toISOString() }
        ];
        for (const t of defaultTypes) { await addDoc(path('roomTypes'), t); }
      } else {
        setRoomTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    const unsubBookings = onSnapshot(path('bookings'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
      setBookings(data);
    });

    const unsubSettings = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'admin'), (d) => {
      if (d.exists()) {
        setAdminPwd(d.data().adminPassword);
      } else {
        setDoc(d.ref, { adminPassword: DEFAULT_ADMIN_PWD });
        setAdminPwd(DEFAULT_ADMIN_PWD);
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => { unsubTypes(); unsubBookings(); unsubSettings(); };
  }, [user]);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (e.target.password.value === adminPwd) {
      setRole(ROLES.ADMIN);
      localStorage.setItem('bnb_role', ROLES.ADMIN);
      setActiveTab('home');
      showMsg("管理者登入成功");
    } else {
      showMsg("密碼錯誤", "error");
    }
  };

  const handleLogout = () => {
    setRole(ROLES.GUEST);
    localStorage.removeItem('bnb_role');
    setActiveTab('home');
    showMsg("已成功登出");
  };

  const checkAvailability = (typeId, checkIn, checkOut, excludeId = null) => {
    const type = roomTypes.find(t => t.id === typeId);
    if (!type) return 0;
    const total = parseInt(type.totalRooms || 0);
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const conflicts = bookings.filter(b => {
      if (b.status === BOOKING_STATUS.CANCELLED || b.roomTypeId !== typeId || (excludeId && b.id === excludeId)) return false;
      return (start < new Date(b.checkOutDate) && end > new Date(b.checkInDate));
    });
    return total - conflicts.length;
  };

  // --- UI 組件 ---
  const DashboardStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const baseStats = [
      { label: "房型總量", value: roomTypes.length, color: "text-blue-600", bg: "bg-blue-50" },
      { label: "有效訂單", value: bookings.filter(b => b.status !== BOOKING_STATUS.CANCELLED).length, color: "text-purple-600", bg: "bg-purple-50" },
    ];
    const adminStats = role === ROLES.ADMIN ? [
      { label: "今日入住", value: bookings.filter(b => b.checkInDate === today && b.status === BOOKING_STATUS.PENDING).length, color: "text-green-600", bg: "bg-green-50" },
      { label: "待退房", value: bookings.filter(b => b.checkOutDate === today && b.status === BOOKING_STATUS.CHECKED_IN).length, color: "text-orange-600", bg: "bg-orange-50" },
      { label: "已取消", value: bookings.filter(b => b.status === BOOKING_STATUS.CANCELLED).length, color: "text-red-600", bg: "bg-red-50" }
    ] : [];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {[...baseStats, ...adminStats].map((s, i) => (
          <Card key={i} className={`p-5 flex flex-col items-center justify-center ${s.bg} border-transparent`}>
            <span className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">{s.label}</span>
            <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
          </Card>
        ))}
      </div>
    );
  };

  const RoomCard = ({ type }) => {
    const available = checkAvailability(type.id, new Date().toISOString().split('T')[0], new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    return (
      <Card className="flex flex-col overflow-hidden group">
        <div className="relative h-64 overflow-hidden">
          <img src={type.imageUrl} alt={type.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-2xl shadow-xl">
            <span className="text-blue-600 font-black text-lg">${type.price}</span>
            <span className="text-gray-400 text-xs font-bold"> / 晚</span>
          </div>
          {available <= 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
              <span className="text-white font-black text-xl tracking-widest border-2 border-white px-6 py-2 rounded-xl">今日已滿</span>
            </div>
          )}
        </div>
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-black text-gray-800">{type.name}</h3>
            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg">上限 {type.capacity} 人</span>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-1">{type.description}</p>
          <div className="flex items-center justify-between mb-6 text-sm font-bold text-gray-400">
            <span>剩餘空房：<span className={available > 0 ? "text-green-500" : "text-red-400"}>{available} 間</span></span>
            <span>總房數：{type.totalRooms}</span>
          </div>
          <Button 
            disabled={available <= 0}
            onClick={() => { setSelectedRoomType(type.id); setActiveTab('book'); window.scrollTo(0,0); }}
            className="w-full"
          >
            {available > 0 ? '立即預訂' : '目前客滿'}
          </Button>
        </div>
      </Card>
    );
  };

  // --- 渲染內容 ---
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-black text-gray-800 tracking-tighter animate-pulse">LUXE BNB 載入中...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {/* 訊息提示 */}
      {message && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-full duration-300 ${
          message.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
        }`}>
          {message.type === 'error' ? <XCircle /> : <CheckCircle className="text-green-400" />}
          <span className="font-bold tracking-wide">{message.text}</span>
        </div>
      )}

      {/* 導航 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('home')}>
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white group-hover:rotate-12 transition-transform">
              <Home size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black tracking-tighter text-blue-600">LUXE BNB</span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-black text-sm uppercase tracking-widest">
            <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}>找房間</button>
            <button onClick={() => setActiveTab('myBookings')} className={activeTab === 'myBookings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}>訂單查詢</button>
            {role === ROLES.ADMIN && (
              <button onClick={() => setActiveTab('admin')} className={activeTab === 'admin' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}>管理後台</button>
            )}
            {role === ROLES.ADMIN ? (
              <Button variant="danger" onClick={handleLogout} className="px-4 py-2 text-xs"><LogOut size={14}/> 登出</Button>
            ) : (
              <button onClick={() => setActiveTab('login')} className="text-gray-300 hover:text-gray-600">後台</button>
            )}
          </div>

          <button className="md:hidden text-gray-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
        {/* 手機選單 */}
        {isMenuOpen && (
          <div className="md:hidden bg-white px-6 py-6 space-y-4 border-b border-gray-100 shadow-2xl animate-in slide-in-from-top-4">
            <button onClick={() => {setActiveTab('home'); setIsMenuOpen(false);}} className="block w-full text-left py-3 font-black border-b border-gray-50">找房間</button>
            <button onClick={() => {setActiveTab('myBookings'); setIsMenuOpen(false);}} className="block w-full text-left py-3 font-black border-b border-gray-50">訂單查詢</button>
            {role === ROLES.ADMIN && (
              <button onClick={() => {setActiveTab('admin'); setIsMenuOpen(false);}} className="block w-full text-left py-3 font-black border-b border-gray-50">管理後台</button>
            )}
            <div className="pt-4">
              {role === ROLES.ADMIN ? (
                <Button variant="danger" className="w-full" onClick={handleLogout}>登出系統</Button>
              ) : (
                <button onClick={() => {setActiveTab('login'); setIsMenuOpen(false);}} className="text-gray-400 w-full text-center py-2">後台登入</button>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10">
        <DashboardStats />

        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-12">
              <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter">探索理想的假期</h2>
              <p className="text-gray-500 font-medium text-lg">精選頂級房型，為您的旅程增添完美的休憩空間。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {roomTypes.map(t => <RoomCard key={t.id} type={t} />)}
            </div>
          </div>
        )}

        {activeTab === 'book' && (
          <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-500">
            <Card className="p-10 border-2 border-blue-50">
              <h2 className="text-3xl font-black mb-8 flex items-center gap-3"><Calendar className="text-blue-600" size={32}/> 線上預訂表單</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const data = Object.fromEntries(fd.entries());
                
                if (new Date(data.checkOutDate) <= new Date(data.checkInDate)) return showMsg("退房日期必須晚於入住日期", "error");
                
                const type = roomTypes.find(t => t.id === data.roomTypeId);
                if (parseInt(data.guests) > type.capacity) return showMsg(`該房型最多入住 ${type.capacity} 人`, "error");
                
                const av = checkAvailability(data.roomTypeId, data.checkInDate, data.checkOutDate);
                if (av <= 0) return showMsg("此日期區間已無空房", "error");

                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bookings'), {
                  ...data,
                  roomTypeName: type.name,
                  status: BOOKING_STATUS.PENDING,
                  createdAt: new Date().toISOString()
                });
                showMsg("訂房成功！祝您旅途愉快");
                setActiveTab('myBookings');
              }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">選擇房型</label>
                  <select name="roomTypeId" defaultValue={selectedRoomType} required className="w-full mt-1.5 px-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold appearance-none">
                    <option value="">請選擇您要預訂的房型</option>
                    {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name} (${t.price}/晚)</option>)}
                  </select>
                </div>
                <Input label="入住日期" name="checkInDate" type="date" required />
                <Input label="退房日期" name="checkOutDate" type="date" required />
                <Input label="您的姓名" name="guestName" required placeholder="例如：王小明" />
                <Input label="聯絡電話" name="phone" type="tel" required placeholder="0912-345-678" />
                <Input label="入住人數" name="guests" type="number" min="1" required defaultValue="1" />
                <div className="md:col-span-2">
                  <Input label="特別需求或備註" name="note" placeholder="如有過敏、提早入住需求請告知..." />
                </div>
                <div className="md:col-span-2 pt-6 flex gap-4">
                  <Button type="submit" className="flex-1 h-14 text-lg">確定預訂房間</Button>
                  <Button variant="secondary" onClick={() => setActiveTab('home')} className="h-14">取消</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'myBookings' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black flex items-center gap-3 text-gray-900"><ClipboardList className="text-blue-600" size={32}/> 我的訂單查詢</h2>
              <Button onClick={() => setActiveTab('home')} variant="outline">繼續訂房</Button>
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[40px] border-4 border-dashed border-gray-100">
                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Info className="text-gray-300" size={40}/>
                </div>
                <p className="text-gray-400 font-black text-xl mb-4">目前沒有訂單紀錄喔！</p>
                <Button onClick={() => setActiveTab('home')}>現在就預約假期</Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {bookings.map(b => (
                  <Card key={b.id} className="p-8 group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-2xl font-black text-gray-800">{b.guestName}</span>
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                            b.status === BOOKING_STATUS.PENDING ? 'bg-blue-100 text-blue-700' :
                            b.status === BOOKING_STATUS.CHECKED_IN ? 'bg-green-100 text-green-700' :
                            b.status === BOOKING_STATUS.CANCELLED ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                          <div>
                            <p className="text-gray-400 font-bold mb-1">房型名稱</p>
                            <p className="font-black text-blue-600">{b.roomTypeName}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-bold mb-1">入住人數</p>
                            <p className="font-black">{b.guests} 人</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-bold mb-1">入住時段</p>
                            <p className="font-black">{b.checkInDate} <span className="text-gray-300 mx-1">→</span> {b.checkOutDate}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {b.status === BOOKING_STATUS.PENDING && (
                          <Button variant="danger" onClick={async () => {
                            if (window.confirm("確定要取消這筆珍貴的預約嗎？")) {
                              await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'bookings', b.id), { status: BOOKING_STATUS.CANCELLED });
                              showMsg("訂單已成功取消");
                            }
                          }}>取消訂單</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'login' && (
          <div className="max-w-md mx-auto py-20 animate-in zoom-in-90 duration-500">
            <Card className="p-10 text-center">
              <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-blue-200">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-black mb-8">管理者登入</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <Input label="輸入後台密碼" type="password" name="password" required placeholder="請輸入您的管理密碼" />
                <Button type="submit" className="w-full h-12">驗證身分</Button>
                <button type="button" onClick={() => setActiveTab('home')} className="text-gray-400 font-bold text-sm">返回首頁</button>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'admin' && role === ROLES.ADMIN && (
          <div className="space-y-16 animate-in slide-in-from-left-4 duration-500">
             {/* 此處保留原本的 AdminPanel 邏輯，主要負責房型 CRUD */}
             <section>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-4xl font-black flex items-center gap-4"><DoorOpen className="text-blue-600" size={40}/> 房型管理後台</h2>
                  <Button onClick={async () => {
                    const name = prompt("房型名稱");
                    if (!name) return;
                    const price = prompt("價格");
                    const capacity = prompt("容納人數");
                    const total = prompt("總房數");
                    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'roomTypes'), {
                      name, price: parseInt(price), capacity: parseInt(capacity), totalRooms: parseInt(total),
                      description: "自訂房型描述...",
                      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
                      createdAt: new Date().toISOString()
                    });
                    showMsg("新房型已上架");
                  }}><Plus size={20}/> 新增房型</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {roomTypes.map(t => (
                    <Card key={t.id} className="p-6 flex items-center gap-6">
                      <img src={t.imageUrl} alt="" className="w-24 h-24 rounded-2xl object-cover" />
                      <div className="flex-1">
                        <h4 className="font-black text-lg">{t.name}</h4>
                        <p className="text-sm text-gray-500">${t.price} / {t.totalRooms} 間</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="danger" className="px-3" onClick={async () => {
                          if (confirm("確定下架此房型？")) {
                            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'roomTypes', t.id));
                            showMsg("房型已下架");
                          }
                        }}><Trash2 size={18}/></Button>
                      </div>
                    </Card>
                  ))}
                </div>
             </section>

             <section>
                <h2 className="text-3xl font-black mb-8">訂單全局監控</h2>
                <Card className="overflow-hidden border-none shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-900 text-white text-[10px] uppercase tracking-widest font-black">
                          <th className="p-5">客戶姓名</th>
                          <th className="p-5">預訂房型</th>
                          <th className="p-5">入住日期</th>
                          <th className="p-5">當前狀態</th>
                          <th className="p-5">操作控制</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bookings.map(b => (
                          <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-5 font-black">{b.guestName}</td>
                            <td className="p-5 text-blue-600 font-bold text-sm">{b.roomTypeName}</td>
                            <td className="p-5 text-gray-400 font-bold text-xs">{b.checkInDate}</td>
                            <td className="p-5">
                              <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-lg uppercase">{b.status}</span>
                            </td>
                            <td className="p-5">
                               <select 
                                 className="bg-white border border-gray-200 rounded-lg text-xs p-1 font-bold outline-none"
                                 value={b.status}
                                 onChange={async (e) => {
                                   await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'bookings', b.id), { status: e.target.value });
                                   showMsg("訂單狀態已更新");
                                 }}
                               >
                                 {Object.values(BOOKING_STATUS).map(s => <option key={s} value={s}>{s}</option>)}
                               </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
             </section>

             <section className="max-w-md">
                <Card className="p-8 border-2 border-gray-900">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Settings size={20}/> 安全設定</h3>
                  <div className="space-y-4">
                    <Input label="重設後台管理密碼" type="password" placeholder="輸入新密碼" id="new_admin_pwd" />
                    <Button className="w-full" onClick={async () => {
                      const val = document.getElementById('new_admin_pwd').value;
                      if (!val) return showMsg("請輸入內容", "error");
                      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'admin'), { adminPassword: val });
                      showMsg("密碼更新成功");
                      document.getElementById('new_admin_pwd').value = "";
                    }}>儲存設定</Button>
                  </div>
                </Card>
             </section>
          </div>
        )}
      </main>

      <footer className="mt-40 border-t border-gray-100 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-6">
               <div className="bg-gray-900 p-2 rounded-xl text-white">
                  <Home size={20} />
               </div>
               <span className="text-xl font-black tracking-tighter">LUXE BNB</span>
            </div>
            <p className="text-gray-400 font-bold text-sm max-w-sm">
              致力於提供最高品質的住宿體驗，每一間房都經過設計師精心打造，只為給您家一般的溫暖。
            </p>
          </div>
          <div className="flex flex-col md:items-end justify-center">
             <div className="flex gap-8 text-sm font-black text-gray-300 mb-4">
               <span>FACEBOOK</span>
               <span>INSTAGRAM</span>
               <span>LINE@</span>
             </div>
             <p className="text-[10px] text-gray-300 font-black">© 2024 LUXE BNB HOSPITALITY GROUP. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
