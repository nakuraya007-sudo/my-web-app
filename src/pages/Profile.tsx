import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Heart, MessageCircle, Bell, User as UserIcon, Book, Settings, Image as ImageIcon, Trash2, Edit3, Plus, X, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, where, setDoc, getDoc } from 'firebase/firestore';
import { notificationService } from '../services/notificationService';

// Email của bạn để xác định quyền chủ sở hữu
const OWNER_EMAIL = 'nakuraya007@gmail.com';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export const Profile = () => {
  const { user } = useAuth();
  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<{ postId: string, commentId: string } | null>(null);
  const [siteProfile, setSiteProfile] = useState({
    cover: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&q=80&w=1920',
    avatar: 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png',
    name: 'YACchan',
    bio: '"Yêu mèo, thích ngủ và đam mê biên tập. Hy vọng những bản edit của mình sẽ mang lại chút nắng ấm cho tâm hồn bạn."'
  });
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'admin_notifs'>('posts');
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: { userId: user?.uid, email: user?.email },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  useEffect(() => {
    if (!isSiteAdmin) return;
    const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAdminNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'admin_notifications');
    });
    return () => unsubscribe();
  }, [isSiteAdmin]);

  useEffect(() => {
    // Luôn tải tin nhắn từ chủ nhà (Site Admin) để làm "Góc nhỏ" công khai
    const q = query(
      collection(db, 'posts'), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribePosts = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setLoading(false);
    });

    // Tải cấu hình trang (Site Profile)
    const unsubscribeProfile = onSnapshot(doc(db, 'site_config', 'profile'), (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSiteProfile(prev => ({ ...prev, ...data }));
          setEditName(data.name || 'YACchan');
          setEditBio(data.bio || '');
        }
      } catch (e) {
        console.error('Profile snap error:', e);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'site_config/profile');
    });

    // Tải số lượng người theo dõi site - Chỉ tải nếu đã đăng nhập hoặc bỏ qua lỗi nếu khách
    const unsubscribeSubs = onSnapshot(collection(db, 'site_followers'), (snap) => {
      try {
        setSubscribersCount(snap.size);
      } catch (e) {
        console.error('Subs size error:', e);
      }
    }, (error) => {
      console.warn('Followers count hidden for guests');
    });

    let unsubscribeSub = () => {};
    if (user?.uid) {
      unsubscribeSub = onSnapshot(doc(db, 'site_followers', user.uid), (docSnap) => {
        setIsSubscribed(docSnap.exists());
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `site_followers/${user?.uid}`);
      });
    }
      
    return () => {
      unsubscribePosts();
      unsubscribeProfile();
      unsubscribeSubs();
      unsubscribeSub();
    };
  }, [user?.uid]);

  // Tải bình luận cho các bài đăng
  useEffect(() => {
    if (posts.length === 0) {
      setComments({});
      return;
    }
    
    const postIds = posts.map(p => p.id);
    const unsubscibes = postIds.map(postId => {
      const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
      return onSnapshot(q, (snap) => {
        setComments(prev => ({
          ...prev,
          [postId]: snap.docs.map(d => ({ id: d.id, ...d.data() }))
        }));
      }, (error) => {
        // Log error but don't crash the whole component
        console.error(`Error loading comments for post ${postId}:`, error);
      });
    });

    return () => unsubscibes.forEach(un => un());
  }, [posts.length]); // Use length as dependency for better stability

  const formatDate = (at: any) => {
    if (!at) return '...';
    try {
      let date: Date;
      if (at instanceof Date) {
        date = at;
      } else if (typeof at.toDate === 'function') {
        date = at.toDate();
      } else if (at.seconds) {
        date = new Date(at.seconds * 1000);
      } else {
        date = new Date(at);
      }
      
      if (isNaN(date.getTime())) return '...';
      return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch (e) {
      return '...';
    }
  };

  const handleUpdateSiteProfile = async (field: string, value: string) => {
    if (!isSiteAdmin) return;
    try {
      await setDoc(doc(db, 'site_config', 'profile'), {
        [field]: value
      }, { merge: true });
    } catch (error) {
      console.error('Error updating site profile:', error);
    }
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (file && isSiteAdmin) {
      if (file.size > 1000000) {
        console.warn('File too large');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateSiteProfile(field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !commentText.trim()) return;
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'Khách quý',
        userAvatar: user.photoURL,
        content: commentText,
        createdAt: serverTimestamp()
      });

      // Notify admin
      if (!isSiteAdmin) {
        notificationService.notifyAdmin(
          'Bình luận mới ✿',
          `${user.displayName || 'Khách'} vừa thỏ thẻ: "${commentText.substring(0, 30)}..."`,
          '/profile'
        );
      }

      setCommentText('');
      setShowCommentInput(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      console.warn('Login required for like');
      return;
    }
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;

      const data = postSnap.data();
      const currentLikes = Array.isArray(data.likes) ? [...data.likes] : [];
      let newLikes;
      
      if (currentLikes.includes(user.uid)) {
        newLikes = currentLikes.filter((uid: string) => uid !== user.uid);
      } else {
        newLikes = [...currentLikes, user.uid];
      }

      await updateDoc(postRef, { likes: newLikes });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!user) {
      console.warn('Login required for subscribe');
      return;
    }
    try {
      const subRef = doc(db, 'site_followers', user.uid);
      if (isSubscribed) {
        await deleteDoc(subRef);
      } else {
        await setDoc(subRef, { userId: user.uid, createdAt: serverTimestamp() });
        // Notify admin
        if (!isSiteAdmin) {
          notificationService.notifyAdmin(
            'Có người theo dõi mới! ✿',
            `${user.displayName || 'Ai đó'} vừa nhấn chuông theo dõi Góc nhỏ của bạn nha!`,
            '/profile'
          );
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      setConfirmDeleteComment(null);
    } catch (error) {
      console.error(error);
      alert('Hic, không xóa được bình luận này rồi...');
    }
  };

  const handleSaveProfile = async () => {
    try {
      await setDoc(doc(db, 'site_config', 'profile'), {
        name: editName,
        bio: editBio
      }, { merge: true });
      setSiteProfile(prev => ({ ...prev, name: editName, bio: editBio }));
      setIsEditingProfile(false);
      alert('Đã cập nhật thông tin thành công rồi nè! ✿');
    } catch (error) {
      console.error(error);
      alert('Lỗi cập nhật rồi... (´; ω ;`)');
    }
  };

  const handlePost = async () => {
    if (!postText.trim() || !user) return;
    
    try {
      if (editingPostId) {
        await updateDoc(doc(db, 'posts', editingPostId), {
          content: postText,
          imageUrl: postImage,
        });
        setEditingPostId(null);
      } else {
        const docRef = await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          authorEmail: user.email,
          content: postText,
          imageUrl: postImage,
          createdAt: serverTimestamp(),
          likes: []
        });

        // Notify followers
        notificationService.notifyFollowersOfPost(siteProfile.name, postText);
      }
      setPostText('');
      setPostImage('');
    } catch (error) {
      handleFirestoreError(error, editingPostId ? OperationType.UPDATE : OperationType.CREATE, 'posts');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { 
        alert('Ảnh hơi nặng rồi, bạn chọn ảnh dưới 800KB nha! (´; ω ;`)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const deletePost = async (id: string) => {
    if (!isSiteAdmin) {
      alert('Chỉ chủ nhà mới có quyền xóa bài thôi nha! ✿');
      return;
    }
    try {
      await deleteDoc(doc(db, 'posts', id));
      setConfirmDeletePostId(null);
      alert('Đã xóa bài đăng thành công! ✿');
    } catch (error) {
      console.error('Delete error:', error);
      handleFirestoreError(error, OperationType.DELETE, `posts/${id}`);
      alert('Lỗi khi xóa bài rồi... Bạn kiểm tra lại quyền hạn nhé!');
    }
  };

  const startEdit = (post: any) => {
    setEditingPostId(post.id);
    setPostText(post.content);
    setPostImage(post.imageUrl || '');
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const getPostAuthorAvatar = (post: any) => {
    try {
      if ((post.authorEmail || post.userId) === OWNER_EMAIL) return siteProfile?.avatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
      if (user && post.userId === user.uid) return user.photoURL || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
      return siteProfile?.avatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
    } catch (e) {
      return 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
    }
  };

  const getPostAuthorName = (post: any) => {
    try {
      if ((post.authorEmail || post.userId) === OWNER_EMAIL) return siteProfile?.name || 'YACchan';
      if (user && post.userId === user.uid) return user.displayName || 'Bạn yêu';
      return siteProfile?.name || 'YACchan';
    } catch (e) {
      return 'Người dùng';
    }
  };

  const getCommentAuthorAvatar = (comment: any) => {
    try {
      if (comment.userEmail === OWNER_EMAIL) return siteProfile?.avatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
      return comment.userAvatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
    } catch (e) {
      return 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-16 h-16 border-8 border-accent-yellow border-t-pink-400 rounded-full kawaii-shadow"
          />
          <p className="text-sm font-bold text-[#4A4A4A]/40 uppercase tracking-widest animate-pulse">
            Đang tải vương quốc... ✿
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="relative mb-20">
        <div className="h-64 md:h-80 w-full bg-soft-yellow rounded-[40px] overflow-hidden kawaii-shadow relative group">
          <img 
            src={siteProfile.cover} 
            className="w-full h-full object-cover opacity-80" 
            alt="cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-soft-yellow/50 via-transparent to-transparent"></div>
          {isSiteAdmin && (
            <label className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-3 rounded-2xl cursor-pointer opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg">
              <Camera className="w-6 h-6 text-[#4A4A4A]" />
              <input type="file" accept="image/*" onChange={(e) => handleProfileImageUpload(e, 'cover')} className="hidden" />
            </label>
          )}
        </div>
        <div className="absolute -bottom-10 left-8 md:left-16 flex items-end gap-6">
          <div className="relative group/avatar">
            <img 
              src={siteProfile.avatar} 
              alt="Owner" 
              className="w-32 h-32 md:w-40 md:h-40 rounded-[40px] border-8 border-white kawaii-shadow object-cover"
            />
            {isSiteAdmin && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-[40px] opacity-0 group-hover/avatar:opacity-100 transition-all cursor-pointer">
                <Camera className="w-8 h-8 text-white" />
                <input type="file" accept="image/*" onChange={(e) => handleProfileImageUpload(e, 'avatar')} className="hidden" />
              </label>
            )}
          </div>
          <div className="mb-4">
            {isSiteAdmin && isEditingProfile ? (
              <div className="flex flex-col gap-2">
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-3xl md:text-5xl font-bold italic text-[#4A4A4A] bg-white/50 rounded-xl px-2 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} className="text-[10px] font-bold bg-green-400 text-white px-3 py-1 rounded-lg">LƯU TÊN</button>
                  <button onClick={() => setIsEditingProfile(false)} className="text-[10px] font-bold bg-gray-400 text-white px-3 py-1 rounded-lg">HỦY</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <h1 className="text-3xl md:text-5xl font-bold italic text-[#4A4A4A] mb-2">{siteProfile.name}</h1>
                {isSiteAdmin && (
                  <button onClick={() => setIsEditingProfile(true)} className="p-2 hover:bg-white rounded-full transition-all">
                    <Edit3 className="w-4 h-4 text-[#4A4A4A]/40" />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm font-bold text-orange-400 uppercase tracking-widest bg-white px-4 py-2 rounded-2xl kawaii-shadow inline-block">
              {isSiteAdmin ? 'Chủ nhân của góc nhỏ ✿' : 'Góc nhỏ của Admin ✿'}
            </p>
          </div>
        </div>
        <div className="absolute -bottom-6 right-8 md:right-16 flex gap-4">
          <button 
            onClick={handleToggleSubscribe}
            className={`p-4 rounded-2xl kawaii-shadow transition-all group flex items-center gap-2 ${
              isSubscribed ? 'bg-pink-400 text-white' : 'bg-white text-pink-400'
            }`}
          >
            <Bell className={`w-6 h-6 ${isSubscribed ? 'fill-current animate-wiggle' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-widest hidden md:block">
              {isSubscribed ? 'Đang nhận tin' : 'Nhận thông báo'}
            </span>
          </button>
          {isSiteAdmin && (
            <Link to="/admin/create" className="bg-[#4A4A4A] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2">
              <Plus className="w-5 h-5" /> Đăng truyện mới
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <aside className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-[40px] p-8 kawaii-shadow border-4 border-accent-yellow/10">
            <h3 className="text-xl font-bold mb-6 text-[#4A4A4A] border-b-2 border-accent-yellow/20 pb-4">Giới thiệu</h3>
            {isSiteAdmin && isEditingProfile ? (
              <textarea 
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full text-sm font-medium bg-soft-yellow/10 rounded-xl p-4 italic text-[#4A4A4A]/60 min-h-[100px] focus:outline-none"
              />
            ) : (
              <p className="text-sm font-medium leading-relaxed text-[#4A4A4A]/60 italic mb-6">
                {(isSiteAdmin 
                  ? (typeof siteProfile.bio === 'string' ? siteProfile.bio : '')
                  : '"Một người yêu đọc truyện đang dạo chơi ở góc nhỏ xinh xắn này."')}
              </p>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-bold text-[#4A4A4A]/40">
                <Heart className="w-4 h-4 text-pink-400" />
                <span>{subscribersCount} Người đăng ký nhận tin</span>
              </div>
              {isSiteAdmin && (
                <div className="flex items-center gap-3 text-sm font-bold text-[#4A4A4A]/40">
                  <Book className="w-4 h-4 text-orange-400" />
                  <span>5 Bộ truyện đang edit</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3">
          <div className="flex gap-8 mb-10 border-b-2 border-accent-yellow/20">
            <button
               onClick={() => setActiveTab('posts')}
               className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'text-orange-400' : 'text-[#4A4A4A]/30'}`}
            >
              Thông báo ✿
              {activeTab === 'posts' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-orange-400 rounded-full" />}
            </button>
            {isSiteAdmin && (
              <button
                onClick={() => setActiveTab('admin_notifs')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'admin_notifs' ? 'text-pink-400' : 'text-[#4A4A4A]/30'}`}
              >
                Nhật ký vương quốc ✿
                {adminNotifs.some(n => !n.read) && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
                )}
                {activeTab === 'admin_notifs' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-pink-400 rounded-full" />}
              </button>
            )}
          </div>

          <div className="relative">
            {activeTab === 'posts' ? (
              <div
                className="space-y-8"
              >
              {isSiteAdmin && ( 
                <div className="bg-white p-8 rounded-[40px] kawaii-shadow border-4 border-dashed border-accent-yellow/30">
                  <h4 className="font-bold text-[#4A4A4A] mb-4">
                    {editingPostId ? 'Đang chỉnh sửa thông báo... ✿' : 'Bạn muốn thông báo gì cho fan thế? (◕‿◕✿)'}
                  </h4>
                  <textarea 
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Nội dung thông báo nè..." 
                    className="w-full bg-soft-yellow/30 rounded-2xl p-6 min-h-[120px] focus:outline-none focus:ring-4 focus:ring-accent-yellow/20 font-medium mb-4"
                  />
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-accent-yellow/30 hover:bg-accent-yellow/10 transition-all cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-orange-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4A]/60">Tải ảnh lên</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      {postImage && (
                        <div className="relative group">
                          <img src={postImage} className="w-10 h-10 rounded-lg object-cover border-2 border-accent-yellow" alt="preview" />
                          <button 
                            onClick={() => setPostImage('')}
                            className="absolute -top-2 -right-2 bg-pink-400 text-white rounded-full p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <input 
                        type="text" 
                        value={postImage} 
                        onChange={(e) => setPostImage(e.target.value)}
                        placeholder="Hoặc dán link ảnh..." 
                        className="text-xs bg-transparent focus:outline-none border-b border-accent-yellow/30 pb-1 flex-grow md:w-40"
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingPostId && (
                        <button 
                          onClick={() => { setEditingPostId(null); setPostText(''); setPostImage(''); }}
                          className="bg-gray-200 text-[#4A4A4A] px-6 py-3 rounded-2xl font-bold uppercase text-xs"
                        >
                          Hủy
                        </button>
                      )}
                      <button 
                        onClick={handlePost}
                        className="bg-[#4A4A4A] text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                      >
                        {editingPostId ? 'Cập nhật' : 'Đăng bài'} <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {Array.isArray(posts) && posts.map(post => {
                  if (!post || !post.id) return null;
                  return (
                    <div 
                      key={post.id}
                      className="bg-white p-8 rounded-[40px] kawaii-shadow border-2 border-accent-yellow/10"
                    >
                        <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <img 
                              src={getPostAuthorAvatar(post)}
                              className="w-12 h-12 rounded-2xl object-cover" 
                              alt="ava" 
                            />
                            <div>
                               <h5 className="font-bold text-[#4A4A4A]">
                                 {getPostAuthorName(post)}
                               </h5>
                            <p className="text-[10px] font-bold text-[#4A4A4A]/40 uppercase tracking-widest">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                      {isSiteAdmin && (
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(post)} className="p-2 hover:bg-blue-50 text-blue-400 rounded-xl transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmDeletePostId(post.id)} className="p-2 hover:bg-pink-50 text-pink-400 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    <p className="text-lg text-[#4A4A4A] font-medium mb-6 leading-relaxed italic whitespace-pre-wrap">{typeof post.content === 'string' ? post.content : ''}</p>
                    {post.imageUrl && (
                      <div className="mb-6 rounded-[32px] overflow-hidden border-4 border-soft-yellow">
                        <img src={post.imageUrl} className="w-full max-h-96 object-cover" alt="post content" />
                      </div>
                    )}
                    <div className="flex items-center gap-6 mb-6">
                      <button 
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-xl transition-all ${
                          user && Array.isArray(post.likes) && post.likes.includes(user.uid) 
                          ? 'bg-pink-400 text-white' 
                          : 'bg-pink-50 text-pink-400'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${user && Array.isArray(post.likes) && post.likes.includes(user.uid) ? 'fill-current' : ''}`} /> {post.likes?.length || 0}
                      </button>
                      <button 
                        onClick={() => {
                          if (!user) {
                             console.warn('Login required');
                          } else setShowCommentInput(showCommentInput === post.id ? null : post.id);
                        }}
                        className="flex items-center gap-2 text-[#4A4A4A]/40 font-bold text-sm hover:text-orange-400 transition-all"
                      >
                        <MessageCircle className="w-5 h-5" /> {comments && comments[post.id]?.length || 0} Bình luận
                      </button>
                    </div>

                    {showCommentInput === post.id && (
                      <div className="overflow-hidden pb-4">
                        <div className="flex gap-3 mb-2">
                          <input 
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Gửi lời nhắn thỏ thẻ... ✿"
                            className="flex-grow bg-soft-yellow/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-yellow/40"
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            className="bg-[#4A4A4A] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
                          >
                            Gửi
                          </button>
                        </div>
                      </div>
                    )}

                    {comments && post.id && Array.isArray(comments[post.id]) && comments[post.id].length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-dashed border-accent-yellow/20">
                        {comments[post.id].slice(0, 10).map((comment: any) => (
                          <div key={comment.id || Math.random().toString()} className="flex gap-3 items-start">
                            <img src={getCommentAuthorAvatar(comment)} className="w-8 h-8 rounded-lg object-cover" alt="ava" />
                            <div className="flex-grow bg-soft-yellow/10 rounded-2xl p-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-[#4A4A4A]">{comment.userName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[#4A4A4A]/30">{formatDate(comment.createdAt)}</span>
                                  {(isSiteAdmin || comment.userId === user?.uid) && (
                                    <button 
                                      onClick={() => setConfirmDeleteComment({ postId: post.id, commentId: comment.id })}
                                      className="p-1 hover:text-pink-400 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-[#4A4A4A]/70">{typeof comment.content === 'string' ? comment.content : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
            ) : (
              <div
                className="space-y-6"
              >
              {Array.isArray(adminNotifs) && adminNotifs.map(notif => {
                if (!notif || !notif.id) return null;
                return (
                  <Link 
                    to={notif.link || '#'} 
                    key={notif.id}
                    onClick={async () => {
                      if (notif.id && !notif.read) {
                        try {
                          await updateDoc(doc(db, 'admin_notifications', notif.id), { read: true });
                        } catch (e) {
                          console.error('Error marking as read:', e);
                        }
                      }
                    }}
                    className={`block bg-white p-6 rounded-3xl kawaii-shadow border-2 transition-all group ${notif.read ? 'border-transparent opacity-60' : 'border-pink-50 hover:border-pink-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-[#4A4A4A] mb-1 group-hover:text-pink-400 transition-colors">{String(notif.title || 'Thông báo')}</h4>
                        <p className="text-sm text-[#4A4A4A]/60 italic font-medium">{String(notif.message || '...')}</p>
                      </div>
                      <span className="text-[9px] font-bold text-[#4A4A4A]/20 uppercase tracking-widest">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {adminNotifs.length === 0 && (
                <div className="py-20 text-center opacity-30 italic">Vương quốc đang yên bình quá... chưa có sự kiện gì mới đâu! ✿</div>
              )}
              </div>
            )}
          </div>
        </main>
      </div>
      <AnimatePresence>
        {confirmDeletePostId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full kawaii-shadow text-center"
            >
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa bài đăng? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Bạn có chắc muốn xóa bản thông báo này không nè? (´; ω ;`)</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeletePostId(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Thôi nha
                </button>
                <button 
                  onClick={() => confirmDeletePostId && deletePost(confirmDeletePostId)}
                  className="flex-1 py-4 bg-pink-400 rounded-2xl font-bold text-white shadow-lg hover:bg-pink-500"
                >
                  Xóa luôn!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteComment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full kawaii-shadow text-center"
            >
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa bình luận? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Lời thỏ thẻ này sẽ biến mất đó, bạn chắc chứ? (´; ω ;`)</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteComment(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Giữ lại
                </button>
                <button 
                  onClick={() => confirmDeleteComment && handleDeleteComment(confirmDeleteComment.postId, confirmDeleteComment.commentId)}
                  className="flex-1 py-4 bg-pink-400 rounded-2xl font-bold text-white shadow-lg hover:bg-pink-500"
                >
                  Xóa đi!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
