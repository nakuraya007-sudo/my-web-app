import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Heart, Menu, LogOut, Bell, Flower, Settings, X, Camera, Github } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { NotificationMenu } from './NotificationMenu';
import { Plus } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { userService } from '../services/userService';
import { db } from '../lib/firebase';

export const Navbar = () => {
  const { user, login, loginWithGithub, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState(user?.displayName || '');
  const [newAvatar, setNewAvatar] = useState(user?.photoURL || '');
  const [updating, setUpdating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isOwner = user?.email?.toLowerCase() === 'nakuraya007@gmail.com'.toLowerCase();

  React.useEffect(() => {
    // 1. Admin notifications
    let unsubscribeAdmin = () => {};
    if (isOwner) {
      const qAdmin = query(
        collection(db, 'admin_notifications'),
        where('read', '==', false)
      );
      unsubscribeAdmin = onSnapshot(qAdmin, (snap) => {
        setUnreadCount(prev => prev + snap.size);
      });
    }

    // 2. User notifications (if logged in)
    let unsubscribeUser = () => {};
    if (user) {
      const qUser = query(
        collection(db, 'users', user.uid, 'notifications'),
        where('read', '==', false)
      );
      unsubscribeUser = onSnapshot(qUser, (snap) => {
        setUnreadCount(prev => prev + snap.size);
      });
    }

    // 3. Global notifications (Announcements)
    // For global, we use localStorage to track the last check for guests/users
    const qGlobal = query(
      collection(db, 'global_notifications'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeGlobal = onSnapshot(qGlobal, (snap) => {
      const lastCheck = parseInt(localStorage.getItem('lastNotificationCheck') || '0');
      const unreadGlobal = snap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toMillis() || 0;
        return createdAt > lastCheck;
      }).length;
      
      // Reset and recalculate to avoid double counting during state updates
      setUnreadCount(curr => {
        // This logic is a bit complex for a single state, 
        // let's simplify by using individual states and summing them up
        return unreadGlobal; 
      });
    });

    return () => {
      unsubscribeAdmin();
      unsubscribeUser();
      unsubscribeGlobal();
    };
  }, [user, isOwner]);

  // Rethinking the above: individual states are safer
  const [adminUnread, setAdminUnread] = useState(0);
  const [userUnread, setUserUnread] = useState(0);
  const [globalUnread, setGlobalUnread] = useState(0);

  React.useEffect(() => {
    setUnreadCount(adminUnread + userUnread + globalUnread);
  }, [adminUnread, userUnread, globalUnread]);

  React.useEffect(() => {
    let unsubAdmin = () => {};
    if (isOwner) {
      const q = query(collection(db, 'admin_notifications'), where('read', '==', false));
      unsubAdmin = onSnapshot(q, (s) => setAdminUnread(s.size));
    } else {
      setAdminUnread(0);
    }
    return unsubAdmin;
  }, [isOwner]);

  React.useEffect(() => {
    let unsubUser = () => {};
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'notifications'), where('read', '==', false));
      unsubUser = onSnapshot(q, (s) => setUserUnread(s.size));
    } else {
      setUserUnread(0);
    }
    return unsubUser;
  }, [user]);

  React.useEffect(() => {
    const q = query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc'));
    const unsubGlobal = onSnapshot(q, (s) => {
      const lastCheck = parseInt(localStorage.getItem('lastNotificationCheck') || '0');
      const unread = s.docs.filter(d => (d.data().createdAt?.toMillis() || 0) > lastCheck).length;
      setGlobalUnread(unread);
    });
    return unsubGlobal;
  }, [showNotifications]); // Recalculate when menu closes/opens

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setIsMenuOpen(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    if (!newName.trim()) {
      alert('Bạn ơi, cho tớ xin cái tên hiển thị nhé! ✿');
      return;
    }
    setUpdating(true);
    try {
      await updateProfile(user, {
        displayName: newName,
        photoURL: newAvatar
      });
      
      // Sync to Firestore
      await userService.syncUserMetadata(user.uid, newName, newAvatar);

      alert('Đã lưu thay đổi thành công! ✿');
      setShowSettings(false);
      
      // Wait a bit for the profile update to propagate before reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error(error);
      alert('Hic, không lưu được rồi, bạn thử lại sau nha! (´; ω ;`)');
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200000) {
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setNewAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <nav className="sticky top-0 z-[100] bg-soft-yellow/90 backdrop-blur-md border-b border-accent-yellow/30 h-20 flex items-center shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center h-full">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <span className="text-2xl font-bold tracking-tight font-serif text-[#4A4A4A]">YACchan</span>
            </Link>
          </div>

          <div className="hidden lg:flex items-center space-x-10">
            <Link to="/" className="text-sm font-bold text-[#4A4A4A]/70 hover:text-orange-400 transition-colors uppercase tracking-widest">Trang chủ</Link>
            {isOwner && (
              <>
                <Link to="/admin/create" className="text-sm font-bold text-orange-400 hover:scale-105 transition-all uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Đăng truyện
                </Link>
                <Link to="/admin/manage" className="text-sm font-bold text-[#4A4A4A]/70 hover:text-orange-400 transition-all uppercase tracking-widest">
                  Quản lý
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-6">
            <form onSubmit={handleSearch} className="relative hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm truyện nè..."
                className="bg-white/80 border-2 border-accent-yellow/20 rounded-2xl py-2 pl-12 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-accent-yellow/20 w-64 transition-all"
              />
            </form>
            
            <div className="flex items-center gap-4 relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-white rounded-full transition-colors group"
              >
                <Bell className="w-6 h-6 text-[#4A4A4A]/60" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-pink-400 rounded-full border-2 border-white text-[10px] text-white flex items-center justify-center font-black px-1 shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationMenu isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

              {user ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setNewName(user.displayName || '');
                      setNewAvatar(user.photoURL || '');
                      setShowSettings(true);
                    }}
                    className="group relative"
                  >
                    <img src={user.photoURL || (isOwner ? 'https://api.dicebear.com/7.x/adventurer/svg?seed=owner' : 'https://api.dicebear.com/7.x/adventurer/svg?seed=visitor')} alt={user.displayName || ''} className="w-10 h-10 rounded-2xl border-4 border-white kawaii-shadow group-hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1 bg-orange-400 p-1 rounded-full text-white shadow-sm scale-75 group-hover:scale-100 transition-transform">
                      <Settings className="w-3 h-3" />
                    </div>
                  </button>
                  <button 
                    onClick={() => logout()}
                    className="p-2 hover:bg-kawaii-pink/30 text-pink-500 rounded-full transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button 
                    onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                    className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl kawaii-shadow text-sm font-bold uppercase tracking-widest text-orange-400 hover:scale-105 transition-all"
                  >
                    <User className="w-5 h-5" />
                    <span className="hidden sm:inline">Đăng nhập</span>
                  </button>
                  
                  {showLoginDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowLoginDropdown(false)} />
                      <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-2.5 shadow-xl border-2 border-accent-yellow/20 z-40 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-3 py-1.5 text-xs font-black text-[#4A4A4A]/40 uppercase tracking-widest border-b border-[#4A4A4A]/5 mb-1">
                          Chọn cổng đăng nhập
                        </div>
                        <button
                          onClick={async () => {
                            setShowLoginDropdown(false);
                            try {
                              await login();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm font-bold text-[#4A4A4A] hover:bg-orange-50 rounded-xl transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform font-serif text-lg">
                            G
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">Google</span>
                            <span className="text-[10px] text-gray-400 font-medium">Đăng nhập an toàn</span>
                          </div>
                        </button>
                        <button
                          onClick={async () => {
                            setShowLoginDropdown(false);
                            try {
                              await loginWithGithub();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm font-bold text-[#4A4A4A] hover:bg-orange-50 rounded-xl transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#24292e]/10 flex items-center justify-center text-[#24292e] group-hover:scale-110 transition-transform">
                            <Github className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">GitHub</span>
                            <span className="text-[10px] text-gray-400 font-medium">Kết nối tài khoản</span>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 hover:bg-white rounded-xl transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6 text-[#4A4A4A]" /> : <Menu className="w-6 h-6 text-[#4A4A4A]" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Side Drawer Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-white/40 backdrop-blur-lg z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-white z-[70] shadow-2xl p-8 flex flex-col lg:hidden border-l border-accent-yellow/40"
            >
              <div className="flex justify-between items-center mb-12">
                <span className="text-xl font-bold font-serif text-[#4A4A4A]">YACchan ✿</span>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white rounded-full">
                  <X className="w-6 h-6 text-[#4A4A4A]" />
                </button>
              </div>

              <div className="space-y-8">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm truyện nè..."
                    className="w-full bg-white border-4 border-accent-yellow/20 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-accent-yellow/50 transition-all font-bold"
                  />
                </form>

                <div className="flex flex-col gap-6">
                  <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-sm font-bold text-[#4A4A4A] tracking-[0.2em] uppercase py-2 flex items-center gap-4 hover:text-orange-400">Trang chủ</Link>
                  {isOwner && (
                    <>
                      <Link to="/admin/create" onClick={() => setIsMenuOpen(false)} className="text-sm font-bold text-orange-400 tracking-[0.2em] uppercase py-2 flex items-center gap-4">Đăng truyện</Link>
                      <Link to="/admin/manage" onClick={() => setIsMenuOpen(false)} className="text-sm font-bold text-[#4A4A4A] tracking-[0.2em] uppercase py-2 flex items-center gap-4 hover:text-orange-400">Quản lý</Link>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-accent-yellow/20">
                <p className="text-[10px] font-bold text-[#4A4A4A]/20 uppercase tracking-[0.3em] text-center italic">Cảm ơn bạn đã ghé thăm! ✿</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/60 backdrop-blur-sm">
            <div className="min-h-full flex items-center md:items-center justify-center p-4 py-10 md:py-20 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[40px] p-8 md:p-12 w-full max-w-2xl kawaii-shadow border-4 border-accent-yellow/20 relative shadow-2xl text-left"
              >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 p-2 hover:bg-soft-yellow rounded-full transition-colors"
              >
              <X className="w-5 h-5 text-[#4A4A4A]" />
            </button>

            <h3 className="text-2xl font-bold italic text-[#4A4A4A] mb-8 pr-12">Cài đặt hồ sơ ✿</h3>

            {!user?.emailVerified && !isOwner && (
              <div className="mb-6 p-4 bg-pink-50 rounded-2xl border-2 border-pink-100 flex items-center gap-3">
                <Bell className="w-5 h-5 text-pink-400 shrink-0" />
                <p className="text-[10px] font-bold text-pink-500 uppercase leading-relaxed tracking-wider">
                  Email chưa được xác thực! Bạn hãy kiểm tra hộp thư nha. ✿
                </p>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="relative group">
                  <img src={newAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=new'} className="w-24 h-24 rounded-3xl object-cover border-4 border-white kawaii-shadow" alt="new ava" />
                  <label className="absolute -bottom-2 -right-2 bg-[#4A4A4A] text-white p-2 rounded-xl cursor-pointer hover:scale-110 transition-all">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
                <p className="text-[10px] font-bold text-[#4A4A4A]/40 uppercase tracking-widest leading-none">NHẤN BIỂU TƯỢNG CAMERA ĐỂ ĐỔI ẢNH</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2 pl-2">Tên hiển thị</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
                />
              </div>

              <button 
                onClick={handleUpdateProfile}
                disabled={updating}
                className="w-full bg-[#4A4A4A] text-white py-5 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl disabled:opacity-50"
              >
                {updating ? 'Đang lưu...' : 'Lưu thay đổi ✿'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )}
  </AnimatePresence>
    </nav>
  );
};
