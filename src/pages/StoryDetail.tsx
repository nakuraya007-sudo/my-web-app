import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Star, BookOpen, Clock, User, Share2, Heart, AlertCircle, Info, Send, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, setDoc, updateDoc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const StoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [isFollowing, setIsFollowing] = useState(false);
  const [chapters, setChapters] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    if (user && id) {
      userService.getReadingProgress(user.uid, id).then(setProgress);
      notificationService.isFollowing(user.uid, id).then(setIsFollowing);
    }
  }, [user, id]);

  const handleFollowToggle = async () => {
    if (!user) {
      alert('Bạn ơi, đăng nhập để theo dõi truyện và nhận thông báo chương mới nha! (◕‿◕✿)');
      return;
    }
    
    const newStatus = !isFollowing;
    setIsFollowing(newStatus); // Optimistic update
    
    if (newStatus) {
      await notificationService.followStory(user.uid, id!);
    } else {
      await notificationService.unfollowStory(user.uid, id!);
    }
  };

  useEffect(() => {
    if (!id) return;

    const unsubscribeStory = onSnapshot(doc(db, 'stories', id), (docSnap) => {
      if (docSnap.exists()) {
        setStory({ id: docSnap.id, ...docSnap.data() });
      } else {
        setStory(null);
      }
      setLoading(false);
    });

    const unsubscribeReviews = onSnapshot(
      query(collection(db, 'stories', id, 'reviews'), orderBy('createdAt', 'desc')),
      (snap) => {
        setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const chaptersRef = collection(db, 'stories', id, 'chapters');
    const chaptersQuery = isSiteAdmin 
      ? query(chaptersRef, orderBy('chapterNumber', 'asc'))
      : query(chaptersRef, where('visibility', '==', 'public'), orderBy('chapterNumber', 'asc'));

    const unsubscribeChapters = onSnapshot(
      chaptersQuery,
      (snap) => {
        setChapters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubscribeStory();
      unsubscribeReviews();
      unsubscribeChapters();
    };
  }, [id, user]);

  const handleReviewSubmit = async () => {
    if (!user) return;
    if (reviewText.trim().split(/\s+/).length < 20) {
      alert('Đánh giá phải trên 20 từ nha bạn yêu! o(>ω<)o');
      return;
    }
    
    try {
      await addDoc(collection(db, 'stories', id!, 'reviews'), {
        userId: user.uid,
        userName: user.displayName || 'Khách quý',
        userAvatar: user.photoURL,
        content: reviewText,
        rating: reviewRating,
        createdAt: serverTimestamp()
      });
      
      const storyRating = story.rating || 5;
      const currentReviewsCount = reviews.length || 1;
      const newRating = ((storyRating * currentReviewsCount) + reviewRating) / (currentReviewsCount + 1);
      
      try {
        await updateDoc(doc(db, 'stories', id!), {
          rating: Number(newRating.toFixed(1))
        });
      } catch (e) {
        console.warn('Could not update story rating');
      }

      alert('Cảm ơn bạn đã đánh giá! (´｡• ᵕ •｡`) ♡');

      // Notify admin
      if (!isSiteAdmin) {
        notificationService.notifyAdmin(
          'Đánh giá mới ✿',
          `${user.displayName || 'Khách'} vừa đánh giá truyện "${story.title}": ${reviewRating} sao.`,
          `/story/${id}`
        );
      }

      setReviewText('');
    } catch (error) {
      console.error(error);
      alert('Hic, gửi đánh giá không được rồi...');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', id!, 'reviews', reviewId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error(error);
      alert('Hic, không xóa được đánh giá này rồi...');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
    </div>
  );

  if (!story || (story.visibility === 'draft' && !isSiteAdmin)) {
    return <div className="p-20 text-center font-bold italic text-[#4A4A4A]/40">Hì hì, truyện này đang được chủ nhà chăm chút ở chế độ riêng tư rồi... (´; ω ;`)</div>;
  }

  const isAnnouncement = story.categories?.includes('Thông báo');

  return (
    <div className="pb-20">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <nav className="text-sm font-bold text-orange-300 mb-6 flex items-center justify-center gap-2 uppercase tracking-widest">
            <Link to="/" className="hover:text-orange-400">Trang chủ</Link>
            <span>✿</span>
            <span>{story.categories?.[0]}</span>
          </nav>
          <h1 className="text-4xl md:text-6xl font-bold italic text-[#4A4A4A] leading-tight mb-4">{story.title}</h1>
          <div className="w-24 h-1.5 bg-accent-yellow mx-auto rounded-full opacity-30"></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-1"
          >
            <div className={`aspect-[3/4] rounded-[40px] overflow-hidden shadow-2xl bg-white border-8 border-white p-1 relative ${isAnnouncement ? 'rotate-1' : ''}`}>
              <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover rounded-[32px]" referrerPolicy="no-referrer" />
              {story.visibility === 'draft' && (
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                  Bản nháp 🔒
                </div>
              )}
            </div>
          </motion.div>

          <div className="col-span-1 lg:col-span-2">
            {!isAnnouncement && (
              <div className="bg-white rounded-[40px] overflow-hidden kawaii-shadow border-4 border-accent-yellow/10 mb-12">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {[
                      { label: 'Hán Việt', value: story.hanViet || 'Đang cập nhật' },
                      { label: 'Tác giả', value: story.originalAuthor || 'Đang cập nhật' },
                      { label: 'Biên tập', value: story.authorName },
                      { label: 'Số chương', value: `${chapters.length} Chương` },
                      { label: 'Tiến độ', value: story.status === 'ongoing' ? 'Đang tiến hành' : story.status === 'completed' ? 'Đã hoàn thành' : 'Tạm ngưng' },
                      { label: 'Thể loại', value: [...(story.categories || []), ...(story.tags || [])].filter((v, i, a) => a.indexOf(v) === i).join(' – ') },
                      { label: 'Góc nhìn', value: story.perspective || 'Đang cập nhật' },
                      { label: 'Danh hiệu', value: story.achievements?.join(' – ') || 'Chưa có' }
                    ].map((row, idx) => (
                      <tr key={idx} className="border-b last:border-b-0 border-accent-yellow/10">
                        <td className="py-4 px-6 bg-soft-yellow/10 w-1/3 font-bold text-orange-400 border-r border-accent-yellow/10">{row.label}</td>
                        <td className="py-4 px-6 text-[#4A4A4A]/70 font-medium italic">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAnnouncement && (
              <div className="bg-white/60 p-8 rounded-[40px] border-4 border-dashed border-orange-200 mb-12">
                <div className="flex items-center gap-4 text-orange-400 font-bold mb-6">
                  <Clock className="w-6 h-6" />
                  <span className="uppercase tracking-widest text-sm">Thông tin cập nhật</span>
                </div>
                <div className="space-y-4 text-[#4A4A4A]/70 font-medium italic">
                  <p>• {chapters.length} thông báo đã đăng</p>
                  <p>• Cập nhật lần cuối: {story.updatedAt ? format(story.updatedAt.toDate(), 'dd/MM/yyyy') : '...'}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-8">
              <Link
                to={`/reader/${story.id}/${chapters[0]?.chapterNumber || 1}`}
                className="flex-1 md:flex-none bg-[#4A4A4A] text-white px-10 py-5 rounded-3xl font-bold uppercase tracking-[0.2em] text-center hover:scale-105 transition-all shadow-xl"
              >
                {isAnnouncement ? 'Xem thông báo' : 'Bắt đầu đọc'}
              </Link>
              
              {!isAnnouncement && progress && (
                <Link
                  to={`/reader/${story.id}/${progress.chapterId}`}
                  className="flex-1 md:flex-none bg-orange-400 text-white px-10 py-5 rounded-3xl font-bold uppercase tracking-[0.2em] text-center hover:scale-105 transition-all shadow-xl border-4 border-white"
                >
                  Đọc tiếp chương {progress.chapterId} ✿
                </Link>
              )}

              <button
                onClick={handleFollowToggle}
                className={`flex items-center justify-center gap-3 px-8 py-5 rounded-3xl font-bold uppercase tracking-widest transition-all shadow-lg hover:scale-105 ${
                  isFollowing 
                    ? 'bg-pink-100 text-pink-500 border-2 border-pink-200' 
                    : 'bg-white text-[#4A4A4A] border-2 border-[#4A4A4A]/10'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFollowing ? 'fill-current' : ''}`} />
                {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {!isAnnouncement && (
            <div className="bg-kawaii-pink/10 p-8 rounded-[40px] border-4 border-dashed border-kawaii-pink/20 w-full mb-12">
              <div className="flex items-center gap-3 text-pink-500 font-bold uppercase tracking-widest text-sm mb-4">
                <AlertCircle className="w-5 h-5" /> Cảnh báo quan trọng
              </div>
              <p className="text-[#4A4A4A]/60 italic font-medium whitespace-pre-wrap">{story.warning || 'Không có cảnh báo đặc biệt.'}</p>
            </div>
          )}

          <div className="border-t-2 border-accent-yellow/20 pt-10 mb-20">
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] mb-6 text-orange-400">{isAnnouncement ? 'Sơ lược' : 'Giới thiệu câu chuyện'}</h3>
            {story.introduction ? (
              <div className="prose prose-orange max-w-none">
                <div className="text-xl leading-[1.8] text-[#4A4A4A]/80 font-medium italic" dangerouslySetInnerHTML={{ __html: story.introduction }} />
              </div>
            ) : (
              <p className="text-xl leading-[1.8] text-[#4A4A4A]/80 font-medium italic whitespace-pre-wrap">
                {!isAnnouncement ? story.description : (story.description || 'Chưa có sơ lược chi tiết.')}
              </p>
            )}
          </div>

          {story.info && (
            <div className="bg-blue-50/50 p-8 rounded-[40px] border-4 border-dashed border-blue-100/50 mb-20">
              <div className="flex items-center gap-3 text-blue-500 font-bold uppercase tracking-widest text-sm mb-4">
                <Info className="w-5 h-5" /> Ghi chú từ Editor
              </div>
              <p className="text-[#4A4A4A]/60 italic font-medium whitespace-pre-wrap">{story.info}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2">
              <section className="mb-20">
                <h2 className="text-3xl font-bold mb-10 flex items-center gap-3 text-[#4A4A4A]">
                  <BookOpen className="text-orange-400" />
                  Chương truyện ({chapters.length})
                </h2>
                <div className="bg-white rounded-[40px] p-8 kawaii-shadow grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chapters.map((chapter) => (
                    <Link
                      key={chapter.id}
                      to={`/reader/${story.id}/${chapter.chapterNumber}`}
                      className="flex flex-col p-6 rounded-3xl hover:bg-soft-yellow transition-all border-2 border-transparent hover:border-accent-yellow group bg-soft-yellow/10"
                    >
                      <span className="font-bold text-[#4A4A4A] group-hover:text-orange-500 mb-2 truncate">
                        Chương {chapter.chapterNumber}: {chapter.title}
                      </span>
                      <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-[#4A4A4A]/40 font-bold">
                        <span>🕒 {chapter.createdAt ? format(chapter.createdAt.toDate(), 'dd/MM/yyyy') : '...'}</span>
                      </div>
                    </Link>
                  ))}
                  {chapters.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[#4A4A4A]/40 font-bold italic">
                      Chương đầu tiên đang được chủ nhà chuẩn bị kỹ lắm, chờ xíu nha! {'(⇀‸↼‶)'}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold mb-10 flex items-center gap-3 text-[#4A4A4A]">
                  <Star className="text-yellow-400 fill-current" />
                  Cảm phẩm từ độc giả ({reviews.length})
                </h2>
                
                {user ? (
                  <div className="bg-accent-yellow/10 rounded-[40px] p-8 border-4 border-dashed border-accent-yellow/30 mb-10">
                    <h4 className="font-bold text-[#4A4A4A] mb-6 flex justify-between items-center">
                      Chia sẻ cảm nhận của bạn ✿
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button 
                            key={s} 
                            onClick={() => setReviewRating(s)}
                            className={`transition-all hover:scale-125 ${reviewRating >= s ? 'text-yellow-500' : 'text-gray-300'}`}
                          >
                            <Star className={`w-6 h-6 ${reviewRating >= s ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </h4>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Cảm nhận của bạn về truyện thế nào?..."
                      className="w-full bg-white rounded-3xl p-6 min-h-[150px] border-2 border-transparent focus:border-accent-yellow/40 focus:outline-none mb-4 font-medium italic"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#4A4A4A]/40 italic uppercase tracking-widest">
                        Độ dài: {reviewText.trim() ? reviewText.trim().split(/\s+/).length : 0} từ (Cần 20 từ)
                      </span>
                      <button
                        onClick={handleReviewSubmit}
                        className="bg-[#4A4A4A] text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                      >
                        Gửi cảm nhận <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-soft-yellow/20 rounded-[40px] p-10 border-2 border-dashed border-accent-yellow/30 mb-10 text-center">
                    <p className="text-[#4A4A4A]/60 font-bold italic mb-6 text-lg">Đăng nhập để thỏ thẻ đôi lời cùng chủ nhà nha! (◕‿◕✿)</p>
                    <button 
                      onClick={() => {
                        const authBtn = document.querySelector('button[title="Đăng nhập"]') as HTMLButtonElement;
                        if (authBtn) authBtn.click();
                      }}
                      className="bg-[#4A4A4A] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest shadow-lg"
                    >
                      Đăng nhập ngay ✿
                    </button>
                  </div>
                )}

                <div className="space-y-8">
                  {reviews.map(review => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={review.id} 
                      className="bg-white p-8 rounded-[40px] kawaii-shadow border-2 border-accent-yellow/5 relative group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <img src={review.userAvatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png'} className="w-12 h-12 rounded-2xl object-cover" alt="ava" />
                          <div>
                            <h5 className="font-bold text-[#4A4A4A]">{review.userName}</h5>
                            <div className="flex gap-1 text-yellow-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-[#4A4A4A]/30 uppercase tracking-widest">
                            {review.createdAt ? format(review.createdAt.toDate(), 'dd/MM/yyyy') : '...'}
                          </span>
                          {(isSiteAdmin || review.userId === user?.uid) && (
                            <button onClick={() => setConfirmDeleteId(review.id)} className="p-2 text-pink-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-pink-50 rounded-xl">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[#4A4A4A]/70 font-medium italic leading-relaxed whitespace-pre-wrap">{review.content}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:col-span-1">
              <div className="sticky top-32 space-y-8">
                {isSiteAdmin && (
                  <div className="bg-[#4A4A4A] rounded-[40px] p-8 shadow-2xl text-white">
                    <h3 className="text-xl font-bold mb-6 border-b border-white/20 pb-4">Admin Dashboard</h3>
                    <div className="space-y-4">
                      <Link to="/admin/manage" className="block w-full text-center bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all mb-2">
                        Quản lý kho truyện ✿
                      </Link>
                      <Link to={`/admin/chapters/${id}`} className="block w-full text-center bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all">
                        Quản lý chương ✿
                      </Link>
                      <Link to={`/admin/edit/${id}`} className="block w-full text-center bg-pink-500/20 hover:bg-pink-500/40 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all text-pink-300">
                        Sửa truyện ✿
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmDeleteId && (
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
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa đánh giá? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Bạn có chắc muốn xóa cảm phẩm này không nè? (´; ω ;`)</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Thôi nha
                </button>
                <button 
                  onClick={() => confirmDeleteId && handleDeleteReview(confirmDeleteId)}
                  className="flex-1 py-4 bg-pink-400 rounded-2xl font-bold text-white shadow-lg hover:bg-pink-500"
                >
                  Xóa luôn!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
