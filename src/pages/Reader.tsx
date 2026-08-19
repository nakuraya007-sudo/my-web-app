import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, List, Settings, Sun, Moon, Type, MessageSquare, Eye, Heart, Clock, Flower, Loader2, Send, X, Trash2, Lock } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, where, getDocs, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';

export const Reader = () => {
  const { user } = useAuth();
  const { storyId, chapterId } = useParams<{ storyId: string; chapterId: string }>();
  const navigate = useNavigate();

  const chapterIndex = Number(chapterId);
  const isLimited = chapterIndex > 10 && !user; // Giới hạn từ chương 11 cho khách chưa đăng nhập ✿

  const [story, setStory] = useState<any>(null);
  const [chapter, setChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState<'sepia' | 'light' | 'dark'>('sepia');
  const [showControls, setShowControls] = useState(true);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [isTOCOpen, setIsTOCOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Save progress
  useEffect(() => {
    if (user && storyId && chapter?.chapterNumber && chapter?.title) {
      userService.saveReadingProgress(user.uid, storyId, chapter.chapterNumber, chapter.title);
    }
  }, [user, storyId, chapter?.chapterNumber, chapter?.title]);

  // Advanced Anti-Copy & Anti-Tamper ✿
  useEffect(() => {
    // 1. DevTools Detection (Simple but effective)
    const detectDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      
      if (widthDiff || heightDiff) {
        setTamperDetected(true);
      }
    };

    // 2. Debugger trap (Force blank screen if they try to debug)
    const interval = setInterval(() => {
      const start = Date.now();
      (() => { debugger; })();
      const end = Date.now();
      if (end - start > 100) {
        setTamperDetected(true);
      }
    }, 2000);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      alert('Chủ nhà hì hì xin phép không cho copy nha! (◕‿◕✿)');
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+A, F12, Ctrl+Shift+I/J/C
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'a')) ||
        (e.key === 'F12') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))
      ) {
        e.preventDefault();
        setTamperDetected(true);
        alert('Ủng hộ chủ nhà, đừng copy nha bạn yêu! ✿');
      }
    };
    
    const handleCopy = (e: ClipboardEvent) => {
      const selection = document.getSelection();
      if (selection && selection.toString().length > 0) {
        e.preventDefault();
        const text = selection.toString();
        // Super garble text: replace all letters with random symbols or shifted characters
        const garbled = text.split('').map(char => {
          if (/\s/.test(char)) return char;
          return String.fromCharCode(char.charCodeAt(0) + Math.floor(Math.random() * 1000) + 500); 
        }).join('');
        
        e.clipboardData?.setData('text/plain', `Ủng hộ YACchan, đừng copy nhé bạn yêu! ✿\n\n${garbled}`);
        setTamperDetected(true);
      }
    };

    window.addEventListener('resize', detectDevTools);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy as any);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', detectDevTools);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy as any);
    };
  }, []);
  
  const [comments, setComments] = useState<any[]>([]);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [tamperDetected, setTamperDetected] = useState(false);

  // Pagination within chapter
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[][]>([]);

  const OWNER_EMAIL = 'nakuraya007@gmail.com';
  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    if (!storyId || !chapter?.id) return;
    const q = query(
      collection(db, 'stories', storyId, 'chapters', chapter.id, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [storyId, chapter?.id]);

  useEffect(() => {
    if (!chapter?.content) return;
    
    // Split into pages of ~1000 words, but keep paragraphs whole
    const paragraphs = chapter.content.split('\n');
    const newPages: string[][] = [];
    let currentBatch: string[] = [];
    let currentWordCount = 0;

    paragraphs.forEach((p: string) => {
      const wordCount = p.split(/\s+/).length;
      if (currentWordCount + wordCount > 1000 && currentBatch.length > 0) {
        newPages.push(currentBatch);
        currentBatch = [p];
        currentWordCount = wordCount;
      } else {
        currentBatch.push(p);
        currentWordCount += wordCount;
      }
    });

    if (currentBatch.length > 0) {
      newPages.push(currentBatch);
    }

    setPages(newPages);
    setCurrentPage(0);
  }, [chapter?.content]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Đăng nhập để thỏ thẻ đôi lời nha! ✿');
      return;
    }
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, 'stories', storyId!, 'chapters', chapter.id, 'comments'), {
        userId: user.uid,
        userName: user.displayName || 'Khách quý',
        userAvatar: user.photoURL,
        content: newComment,
        paragraphIndex: activeParagraphIndex,
        createdAt: serverTimestamp()
      });

      // Notify admin
      if (!isSiteAdmin) {
        notificationService.notifyAdmin(
          'Thỏ thẻ mới ✿',
          `${user.displayName || 'Khách'} vừa để lại lời nhắn trong chương "${chapter.title}" của truyện "${story?.title}": "${newComment.substring(0, 30)}..."`,
          `/reader/${storyId}/${chapterId}`
        );
      }

      setNewComment('');
      if (activeParagraphIndex !== null) setIsCommentsOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId!, 'chapters', chapter.id, 'comments', commentId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error(error);
      alert('Hic, không xóa được bình luận này rồi...');
    }
  };

  useEffect(() => {
    if (!storyId || !chapterId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const storySnap = await getDoc(doc(db, 'stories', storyId));
        if (storySnap.exists()) {
          const storyData = { id: storySnap.id, ...storySnap.data() } as any;
          setStory(storyData);
          
          if (storyData.visibility === 'draft' && !isSiteAdmin) {
            setChapter(null);
            setLoading(false);
            return;
          }

          // Fetch chapters with visibility filter for non-admins to avoid permission errors
          const chaptersRef = collection(db, 'stories', storyId, 'chapters');
          let q;
          if (isSiteAdmin) {
            q = query(chaptersRef, orderBy('chapterNumber', 'asc'));
          } else {
            // Firestore rules: allow read: if resource.data.visibility == 'public'
            // We use where('visibility', '==', 'public') to match the rule
            q = query(chaptersRef, where('visibility', '==', 'public'), orderBy('chapterNumber', 'asc'));
          }
          
          const chaptersSnap = await getDocs(q);
          const allChaps = chaptersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          
          setAllChapters(allChaps);

          // Current chapter
          const current = allChaps.find(d => d.chapterNumber === Number(chapterId));
          if (current) {
            setChapter(current);
            setIsUnlocked(!current.password || isSiteAdmin);
          } else {
            setChapter(null);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [storyId, chapterId, isSiteAdmin]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (window.scrollY > 100) setShowControls(false);
      }, 3000);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
      <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
    </div>
  );

  if (!story || !chapter) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF5] gap-4">
      <p className="font-bold italic text-[#4A4A4A]/40">Kìa, chương này hình như lạc mất rồi... (´; ω ;`)</p>
      <Link to="/" className="text-orange-400 font-bold hover:underline">Quay về trang chủ ✿</Link>
    </div>
  );

  const themes = {
    sepia: 'bg-[#FFFDF5] text-[#4A4A4A]',
    light: 'bg-white text-gray-900',
    dark: 'bg-[#1a1a1a] text-gray-300',
  };

  if (tamperDetected) return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-8 text-center select-none font-serif">
      <div className="bg-pink-50 p-12 rounded-[60px] border-8 border-dashed border-pink-100 kawaii-shadow">
        <Flower className="w-24 h-24 text-pink-400 mx-auto mb-8 animate-bounce" />
        <h2 className="text-3xl font-bold italic text-[#4A4A4A] mb-4">Ối! Bạn đang làm gì thế? ✿</h2>
        <p className="text-[#4A4A4A]/60 font-medium italic mb-8 max-w-sm">
          Vì lý do bảo mật và bảo vệ công sức của chủ nhà, trang web xin phép được tạm ẩn nội dung nha! (◕‿◕✿)
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-pink-400 text-white px-12 py-5 rounded-3xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
        >
          Tớ hứa không làm vậy nữa! ✿
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 font-serif select-none ${themes[theme]}`}>
      <style>
        {`
          @media print {
            body { display: none !important; }
          }
          ::selection {
            background: transparent;
            color: inherit;
          }
        `}
      </style>
      
      <AnimatePresence>
        {showControls && (
          <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className={`fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center backdrop-blur-md border-b border-accent-yellow/20 bg-inherit opacity-95`}
          >
            <Link to={`/story/${story.id}`} className="flex items-center gap-3 hover:text-orange-400 font-bold transition-all">
              <ChevronLeft className="w-5 h-5" />
              <span className="truncate max-w-[200px] italic">{story.title}</span>
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>

      <article className="max-w-3xl mx-auto px-6 py-24 md:py-40">
        <header className="mb-20 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-orange-300 font-bold mb-4">Chương {chapterId}</p>
          <h1 className="text-4xl md:text-5xl font-bold italic leading-tight">{chapter.title}</h1>
        </header>

        <div
          className="leading-[2] transition-all duration-300 relative"
          style={{ fontSize: `${fontSize}px` }}
        >
          {isLimited ? (
            <div className="py-20 bg-white/40 rounded-[40px] border-4 border-dashed border-accent-yellow/30 text-center px-8">
              <div className="bg-white p-6 rounded-3xl kawaii-shadow inline-block mb-6">
                <Flower className="w-12 h-12 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold italic text-[#4A4A4A] mb-4">Uầy! Bạn đọc hăng say quá...</h3>
              <p className="text-[#4A4A4A]/60 font-medium italic mb-8 max-w-sm mx-auto">
                Từ chương 11 trở đi, bạn hãy đăng nhập để ủng hộ tớ và lưu lại dấu chân của mình nhé! (◕‿◕✿)
              </p>
              <button 
                onClick={() => {
                  const authBtn = document.querySelector('button[title="Đăng nhập"]') as HTMLButtonElement;
                  if (authBtn) authBtn.click();
                }}
                className="bg-[#4A4A4A] text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
              >
                Đăng nhập đọc tiếp ✿
              </button>
            </div>
          ) : !isUnlocked ? (
            <div className="py-20 bg-white/40 rounded-[40px] border-4 border-dashed border-accent-yellow/30 text-center px-8">
              <div className="bg-white p-6 rounded-3xl kawaii-shadow inline-block mb-6">
                <Lock className="w-12 h-12 text-pink-400" />
              </div>
              <h3 className="text-2xl font-bold italic text-[#4A4A4A] mb-4">Chương này có khóa nè! ✿</h3>
              <p className="text-[#4A4A4A]/60 font-medium italic mb-8 max-w-sm mx-auto">
                Chương này được chủ nhà đặt một chiếc khóa xinh xắn. Bạn hãy nhập mã để mở nha! (◕‿◕✿)
              </p>
              <div className="max-w-xs mx-auto space-y-4">
                <input 
                  type="text"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Nhập mã bí mật..."
                  className="w-full bg-white rounded-2xl px-6 py-4 border-2 border-accent-yellow/20 focus:border-accent-yellow/50 focus:outline-none text-center font-bold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputPassword === chapter.password) setIsUnlocked(true);
                  }}
                />
                <button 
                  onClick={() => {
                    if (inputPassword === chapter.password) {
                      setIsUnlocked(true);
                    } else {
                      alert('Mã không đúng rồi, thử lại nha! (´; ω ;`)');
                    }
                  }}
                  className="w-full bg-[#4A4A4A] text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                >
                  Mở khóa ✿
                </button>
              </div>
            </div>
          ) : (
            <div className="italic text-[#4A4A4A]/80 leading-relaxed font-serif">
              {(pages[currentPage] || []).map((para: string, pageIdx: number) => {
                if (!para.trim()) return <br key={pageIdx} />;
                // Find actual index in whole content or just use a stable ID?
                // For simplicity, we use pageIdx + offset
                const realIdx = pages.slice(0, currentPage).reduce((acc, curr) => acc + curr.length, 0) + pageIdx;
                const paraComments = comments.filter(c => c.paragraphIndex === realIdx);
                return (
                  <div key={realIdx} className="group relative mb-8 hover:bg-orange-50/30 transition-all rounded-xl p-2 -mx-2">
                    <div dangerouslySetInnerHTML={{ __html: para }} />
                    <button 
                      onClick={() => {
                        setActiveParagraphIndex(realIdx);
                        setIsCommentsOpen(true);
                      }}
                      className="absolute -right-4 md:-right-12 top-0 p-2 bg-accent-yellow/20 text-orange-400 rounded-full hover:bg-orange-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center min-w-[32px] min-h-[32px]"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {paraComments.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-pink-400 text-white text-[8px] rounded-full w-5 h-5 flex items-center justify-center border-2 border-inherit font-bold">
                          {paraComments.length}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paging controls (1 - 2 - 3 - 4) */}
        {pages.length > 1 && (
          <div className="mt-16 flex justify-center gap-4">
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentPage(idx);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center transition-all ${
                  currentPage === idx 
                  ? 'bg-orange-400 text-white shadow-lg scale-110' 
                  : 'bg-white text-orange-400 border-2 border-accent-yellow/20 hover:bg-soft-yellow'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-8 border-t-4 border-dashed border-accent-yellow/20 pt-16">
          <button
            onClick={() => navigate(`/reader/${storyId}/${Number(chapterId) - 1}`)}
            disabled={Number(chapterId) <= 1}
            className="w-full md:w-auto flex items-center justify-center gap-3 bg-white kawaii-shadow px-8 py-4 rounded-2xl hover:bg-soft-yellow disabled:opacity-20 font-bold uppercase text-xs tracking-[0.2em] transition-all text-orange-400"
          >
            <ChevronLeft className="w-5 h-5" /> Chương trước
          </button>
          <button 
            onClick={() => setIsTOCOpen(true)}
            className="flex items-center gap-3 bg-accent-yellow text-[#4A4A4A] px-10 py-4 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] hover:scale-105 transition-all shadow-lg"
          >
            <List className="w-5 h-5" /> Mục lục
          </button>
          <button
            onClick={() => navigate(`/reader/${storyId}/${Number(chapterId) + 1}`)}
            className="w-full md:w-auto flex items-center justify-center gap-3 bg-white kawaii-shadow px-8 py-4 rounded-2xl hover:bg-soft-yellow font-bold uppercase text-xs tracking-[0.2em] transition-all text-orange-400"
          >
            Chương sau <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-32 pt-16 border-t-8 border-soft-yellow/30">
          <h2 className="text-3xl font-bold italic text-[#4A4A4A] mb-12 flex items-center gap-4">
            <MessageSquare className="text-orange-400 w-8 h-8" />
            Cảm nhận về chương ({comments.length})
          </h2>

          {user ? (
            <form onSubmit={handleAddComment} className="mb-16">
              <div className="bg-white p-8 rounded-[40px] kawaii-shadow border-4 border-accent-yellow/10">
                <textarea
                  value={activeParagraphIndex === null ? newComment : ''}
                  onChange={(e) => {
                    setActiveParagraphIndex(null);
                    setNewComment(e.target.value);
                  }}
                  onFocus={() => setActiveParagraphIndex(null)}
                  placeholder="Thỏ thẻ vài lời cùng chủ nhà nè... ✿"
                  className="w-full bg-soft-yellow/10 rounded-3xl p-6 min-h-[120px] focus:outline-none focus:ring-4 focus:ring-accent-yellow/20 mb-4 font-medium italic border-2 border-transparent transition-all"
                />
                <div className="flex justify-end">
                  <button 
                    disabled={submittingComment || (activeParagraphIndex !== null && !!newComment)}
                    type="submit"
                    className="bg-[#4A4A4A] text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-3 disabled:opacity-50"
                  >
                    {submittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Gửi đi ✿
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="bg-soft-yellow/10 p-10 rounded-[40px] border-4 border-dashed border-accent-yellow/20 mb-16 text-center">
              <p className="font-bold italic text-[#4A4A4A]/60 mb-6">Đăng nhập để thỏ thẻ vài lời nha! (◕‿◕✿)</p>
              <button 
                onClick={() => {
                  const authBtn = document.querySelector('button[title="Đăng nhập"]') as HTMLButtonElement;
                  if (authBtn) authBtn.click();
                }}
                className="bg-[#4A4A4A] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl"
              >
                Đăng nhập ngay ✿
              </button>
            </div>
          )}

          <div className="space-y-8">
            {comments.map(comment => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={comment.id} 
                className="bg-white p-8 rounded-[40px] kawaii-shadow border-2 border-accent-yellow/5 relative group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <img src={comment.userAvatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png'} className="w-10 h-10 rounded-xl object-cover" alt="ava" />
                    <div>
                      <div className="flex items-center gap-3">
                        <h5 className="font-bold text-[#4A4A4A]">{comment.userName}</h5>
                        {comment.paragraphIndex !== null && (
                          <span className="text-[8px] font-bold bg-soft-yellow/30 text-orange-400 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-orange-100">
                            Đoạn {comment.paragraphIndex + 1}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] font-bold text-[#4A4A4A]/20 uppercase tracking-[0.2em]">
                        {comment.createdAt ? format(comment.createdAt.toDate(), 'HH:mm - dd/MM/yyyy') : 'Đang gửi...'}
                      </span>
                    </div>
                  </div>
                  {(isSiteAdmin || comment.userId === user?.uid) && (
                    <button onClick={() => setConfirmDeleteId(comment.id)} className="p-2 text-pink-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-pink-50 rounded-xl">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[#4A4A4A]/70 font-medium italic leading-relaxed whitespace-pre-wrap">{comment.content}</p>
              </motion.div>
            ))}
            {comments.length === 0 && (
              <div className="text-center py-20 opacity-30">
                <MessageSquare className="w-16 h-16 mx-auto mb-4" />
                <p className="font-bold italic">Chưa có thỏ thẻ nào trong chương này hết á!</p>
              </div>
            )}
          </div>
        </div>
      </article>

      <AnimatePresence>
        {isCommentsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCommentsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[90] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold italic text-[#4A4A4A]">Thỏ thẻ đoạn này ✿</h3>
                  <p className="text-[10px] font-bold text-[#4A4A4A]/30 uppercase tracking-widest mt-1">Đoạn thứ {activeParagraphIndex! + 1}</p>
                </div>
                <button onClick={() => setIsCommentsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto space-y-6 mb-8 pr-2">
                {comments.filter(c => c.paragraphIndex === activeParagraphIndex).map(comment => (
                  <div key={comment.id} className="bg-soft-yellow/10 p-6 rounded-3xl border-2 border-accent-yellow/10 relative group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <img src={comment.userAvatar || 'https://cdn-icons-png.flaticon.com/512/2663/2663067.png'} className="w-8 h-8 rounded-lg object-cover" alt="ava" />
                        <div>
                          <h6 className="font-bold text-sm text-[#4A4A4A]">{comment.userName}</h6>
                          <span className="text-[6px] font-bold text-[#4A4A4A]/20 uppercase tracking-widest">
                            {comment.createdAt ? format(comment.createdAt.toDate(), 'dd/MM/yyyy') : '...'}
                          </span>
                        </div>
                      </div>
                      {(isSiteAdmin || comment.userId === user?.uid) && (
                        <button onClick={() => setConfirmDeleteId(comment.id)} className="p-1 text-pink-400 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#4A4A4A]/70 font-medium italic leading-relaxed">{comment.content}</p>
                  </div>
                ))}
                {comments.filter(c => c.paragraphIndex === activeParagraphIndex).length === 0 && (
                  <div className="text-center py-20 opacity-30">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold italic">Chưa ai thỏ thẻ đoạn này hết á!</p>
                  </div>
                )}
              </div>

              {user ? (
                <form onSubmit={handleAddComment} className="mt-auto">
                  <div className="relative">
                    <textarea
                      value={activeParagraphIndex !== null ? newComment : ''}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Viết thỏ thẻ cụ thể đoạn này nha..."
                      className="w-full bg-soft-yellow/10 rounded-2xl p-4 pr-14 min-h-[100px] border-2 border-transparent focus:border-accent-yellow/30 focus:outline-none text-sm font-medium italic"
                    />
                    <button 
                      disabled={submittingComment || !newComment.trim()}
                      type="submit"
                      className="absolute right-4 bottom-4 p-3 bg-[#4A4A4A] text-white rounded-xl shadow-lg hover:scale-110 transition-all disabled:opacity-50"
                    >
                      {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-center text-xs font-bold italic text-[#4A4A4A]/40">Đăng nhập để thỏ thẻ nha ✿</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTOCOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTOCOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white z-[70] shadow-2xl p-8 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-bold italic text-[#4A4A4A]">Mục lục ✿</h3>
                <button onClick={() => setIsTOCOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                {allChapters.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      navigate(`/reader/${storyId}/${ch.chapterNumber}`);
                      setIsTOCOpen(false);
                    }}
                    className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                      ch.chapterNumber === Number(chapterId) 
                      ? 'bg-accent-yellow/20 border-accent-yellow text-orange-500' 
                      : 'bg-soft-yellow/10 border-transparent hover:bg-soft-yellow/20'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 opacity-40">Chương {ch.chapterNumber}</span>
                    <span className="font-bold block truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-8 flex justify-center backdrop-blur-md border-t border-accent-yellow/20 bg-inherit opacity-95"
          >
            <div className="flex items-center gap-12">
              <button 
                onClick={() => setIsTOCOpen(true)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="p-3 rounded-2xl group-hover:bg-accent-yellow/20 transition-all">
                  <List className="w-6 h-6 text-orange-400" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#4A4A4A]/40">Mục lục</span>
              </button>
              <button 
                onClick={() => setShowSettingsMenu(true)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="p-3 rounded-2xl group-hover:bg-accent-yellow/20 transition-all">
                  <Settings className="w-6 h-6 text-orange-400" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#4A4A4A]/40">Cài đặt</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsMenu(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[80]"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/90 backdrop-blur-md z-[90] rounded-[32px] shadow-2xl p-6 border-4 border-accent-yellow/10"
            >
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex items-center gap-4 border-r-2 border-accent-yellow/10 pr-6">
                  <button onClick={() => setTheme('light')} className={`p-3 rounded-xl transition-all ${theme === 'light' ? 'bg-orange-400 text-white' : 'hover:bg-accent-yellow/20 text-gray-400'}`}><Sun className="w-5 h-5" /></button>
                  <button onClick={() => setTheme('sepia')} className={`p-3 rounded-xl transition-all ${theme === 'sepia' ? 'bg-orange-400 text-white font-bold' : 'hover:bg-accent-yellow/20 text-orange-400 font-bold'}`}>S</button>
                  <button onClick={() => setTheme('dark')} className={`p-3 rounded-xl transition-all ${theme === 'dark' ? 'bg-orange-400 text-white' : 'hover:bg-accent-yellow/20 text-gray-400'}`}><Moon className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 w-full flex items-center gap-6">
                  <Type className="w-4 h-4 text-[#4A4A4A]/40 shrink-0" />
                  <input 
                    type="range" 
                    min="14" 
                    max="32" 
                    value={fontSize} 
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-accent-yellow/20 rounded-full appearance-none cursor-pointer accent-orange-400"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <input 
                      type="number" 
                      value={fontSize}
                      onChange={(e) => setFontSize(Math.min(48, Math.max(12, parseInt(e.target.value) || 14)))}
                      className="w-12 bg-white border-2 border-accent-yellow/20 rounded-lg text-center font-bold text-xs py-1"
                    />
                    <span className="text-[10px] font-bold text-[#4A4A4A]/40 uppercase tracking-widest">px</span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSettingsMenu(false)}
                  className="p-3 hover:bg-soft-yellow rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-[#4A4A4A]/40" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa bình luận? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Lời thỏ thẻ này sẽ biến mất đó, bạn chắc chứ? (´; ω ;`)</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Giữ lại
                </button>
                <button 
                  onClick={() => confirmDeleteId && handleDeleteComment(confirmDeleteId)}
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
