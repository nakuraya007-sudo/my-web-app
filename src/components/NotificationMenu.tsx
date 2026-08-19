import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Sparkles, Book, User, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { Link } from 'react-router-dom';

interface NotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationMenu: React.FC<NotificationProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStory, setFilterStory] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('latest');

  const isOwner = user?.email?.toLowerCase() === 'nakuraya007@gmail.com'.toLowerCase();

  useEffect(() => {
    setLoading(true);
    let unsubGlobal = () => {};
    let unsubUser = () => {};
    let unsubAdmin = () => {};

    // 1. Global Notifications
    const qGlobal = query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc'));
    unsubGlobal = onSnapshot(qGlobal, (snap) => {
      const globalDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), isGlobal: true }));
      setGlobalNotifs(globalDocs);
    });

    // 2. Personal Notifications
    if (user) {
      const qUser = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'));
      unsubUser = onSnapshot(qUser, (snap) => {
        const userDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), isUser: true }));
        setUserNotifs(userDocs);
      });
    } else {
      setUserNotifs([]);
    }

    // 3. Admin Notifications
    if (isOwner) {
      const qAdmin = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
      unsubAdmin = onSnapshot(qAdmin, (snap) => {
        const adminDocs = snap.docs.map(d => ({ id: d.id, ...d.data(), isAdmin: true }));
        setAdminNotifs(adminDocs);
      });
    } else {
      setAdminNotifs([]);
    }

    return () => {
      unsubGlobal();
      unsubUser();
      unsubAdmin();
    };
  }, [user, isOwner]);

  const [globalNotifs, setGlobalNotifs] = useState<any[]>([]);
  const [userNotifs, setUserNotifs] = useState<any[]>([]);
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);

  useEffect(() => {
    const combined = [...globalNotifs, ...userNotifs, ...adminNotifs].sort((a, b) => {
      const dateA = a.createdAt?.toMillis() || 0;
      const dateB = b.createdAt?.toMillis() || 0;
      return dateB - dateA;
    });
    setNotifications(combined);
    setLoading(false);
  }, [globalNotifs, userNotifs, adminNotifs]);

  useEffect(() => {
    if (isOpen) {
      // Mark global as "seen" in localStorage
      localStorage.setItem('lastNotificationCheck', Date.now().toString());
    }
  }, [isOpen]);

  const uniqueStories = Array.from(new Set(
    notifications
      .map(n => n.title || null)
      .filter(Boolean)
  )).sort();

  const filteredNotifications = notifications.filter(n => {
    // Story/Title filter
    if (filterStory !== 'all') {
      if (n.title !== filterStory) return false;
    }
    return true;
  });

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    
    // Mark personal notifications
    if (user) {
      userNotifs.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
      });
    }

    // Mark admin notifications
    if (isOwner) {
      adminNotifs.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'admin_notifications', n.id), { read: true });
      });
    }

    await batch.commit();
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      if (notif.isUser && user) {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true });
      } else if (notif.isAdmin && isOwner) {
        await updateDoc(doc(db, 'admin_notifications', notif.id), { read: true });
      }
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-white/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-8 w-[95vw] md:w-[450px] max-h-[80vh] bg-white rounded-[32px] kawaii-shadow border-4 border-accent-yellow/10 z-[101] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="bg-soft-yellow/50 p-6 flex justify-between items-center border-b-2 border-accent-yellow/10 shrink-0">
              <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-400" /> Thông báo ✿
              </h3>
              <div className="flex gap-2 items-center">
                {notifications.some(n => !n.read) && (
                  <button onClick={markAllAsRead} className="text-[10px] font-bold text-orange-400 hover:underline uppercase tracking-widest">Đọc hết</button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[#4A4A4A]/40" />
                </button>
              </div>
            </div>

            {/* Filters Section */}
            <div className="p-4 bg-soft-yellow/10 border-b border-accent-yellow/10 grid grid-cols-3 gap-2 shrink-0">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white rounded-xl px-2 py-2 text-[10px] font-bold border border-accent-yellow/10 outline-none text-[#4A4A4A]"
              >
                <option value="all">Tất cả loại</option>
                <option value="chapter">Chương mới</option>
                <option value="announcement">Thông báo</option>
                <option value="comment">Bình luận</option>
              </select>
              <select 
                value={filterStory}
                onChange={(e) => setFilterStory(e.target.value)}
                className="bg-white rounded-xl px-2 py-2 text-[10px] font-bold border border-accent-yellow/10 outline-none text-[#4A4A4A] truncate"
              >
                <option value="all">Truyện</option>
                {uniqueStories.map(story => (
                  <option key={story} value={story}>{story}</option>
                ))}
              </select>
              <select 
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="bg-white rounded-xl px-2 py-2 text-[10px] font-bold border border-accent-yellow/10 outline-none text-[#4A4A4A]"
              >
                <option value="latest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {loading ? (
                <div className="py-20 flex flex-col items-center gap-4 text-[#4A4A4A]/40">
                  <div className="w-8 h-8 border-4 border-accent-yellow border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest italic">Đang tải...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-20 text-center">
                  <Sparkles className="w-12 h-12 text-accent-yellow/30 mx-auto mb-4" />
                  <p className="text-sm font-bold italic text-[#4A4A4A]/30">Hì hì, chưa có thông báo nào phù hợp nè... ✿</p>
                </div>
              ) : (
                filteredNotifications
                  .filter(n => {
                    if (filterType === 'all') return true;
                    if (filterType === 'chapter') return n.title?.includes('Chương mới');
                    if (filterType === 'announcement') return n.isGlobal;
                    if (filterType === 'comment') return n.title?.includes('Bình luận') || n.title?.includes('Đánh giá');
                    return true;
                  })
                  .sort((a, b) => {
                    const dateA = a.createdAt?.toMillis() || a.createdAt?.seconds * 1000 || 0;
                    const dateB = b.createdAt?.toMillis() || b.createdAt?.seconds * 1000 || 0;
                    return filterTime === 'latest' ? dateB - dateA : dateA - dateB;
                  })
                  .map((notif) => {
                    const isComment = notif.title?.toLowerCase().includes('bình luận') || notif.title?.toLowerCase().includes('đánh giá');
                    const isAnnouncement = notif.isGlobal;
                    
                    return (
                      <Link
                        key={notif.id} 
                        to={notif.link || '#'}
                        onClick={() => handleNotificationClick(notif)}
                        className={`block p-4 rounded-2xl transition-all border-2 relative ${notif.read ? 'bg-white border-transparent' : 'bg-soft-yellow/20 border-accent-yellow/30 shadow-sm'}`}
                      >
                        {!notif.read && !notif.isGlobal && (
                          <div className="absolute left-0 top-3 bottom-3 w-1 bg-orange-400 rounded-full" />
                        )}
                        <div className="flex gap-4">
                          <div className={`p-2 rounded-xl shrink-0 h-fit ${
                            isComment ? 'bg-blue-100 text-blue-400' : 
                            isAnnouncement ? 'bg-accent-yellow/20 text-orange-400' :
                            'bg-pink-100 text-pink-400'
                          }`}>
                            {isComment ? <MessageCircle className="w-5 h-5" /> : 
                             isAnnouncement ? <Sparkles className="w-5 h-5" /> :
                             <Bell className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-[#4A4A4A] mb-1 truncate">{notif.title}</h4>
                            <p className="text-xs text-[#4A4A4A]/60 font-medium mb-2 line-clamp-2">{notif.message}</p>
                            <span className="text-[9px] font-bold text-orange-400/60 uppercase tracking-widest leading-none block">
                              {(() => {
                                const at = notif.createdAt;
                                if (!at) return 'Vừa xong';
                                try {
                                  if (at.toDate) return format(at.toDate(), 'HH:mm - dd/MM', { locale: vi });
                                  if (at.seconds) return format(new Date(at.seconds * 1000), 'HH:mm - dd/MM', { locale: vi });
                                } catch (e) {}
                                return '...';
                              })()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
              )}
            </div>
            <div className="p-4 bg-gray-50 text-center border-t border-gray-100 shrink-0">
              <p className="text-[10px] font-bold text-[#4A4A4A]/20 uppercase tracking-[0.3em] italic">YACchan Notifications ✿</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
