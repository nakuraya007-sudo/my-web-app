import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TextEditor } from '../components/TextEditor';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Book, Edit3, Trash2, Plus, ArrowLeft, Send, X, Loader2, Save, Globe, Lock, ClipboardList, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from '../services/notificationService';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const ManageChapters = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<any[]>([]);
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [parsedChapters, setParsedChapters] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkVisibility, setBulkVisibility] = useState<'public' | 'draft'>('public');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    chapterNumber: 0,
    visibility: 'public' as 'public' | 'draft',
    password: ''
  });

  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isSiteAdmin || !storyId) return;

    const fetchStory = async () => {
      const snap = await getDoc(doc(db, 'stories', storyId));
      if (snap.exists()) setStory(snap.data());
    };
    fetchStory();

    const q = query(collection(db, 'stories', storyId, 'chapters'), orderBy('chapterNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setChapters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSiteAdmin, storyId]);

  const handleBulkParse = () => {
    // Improved regex: optional spaces at start, mandatory "Chương", then number, then optional separator, then title
    const chapterPattern = /^\s*Chương\s+(\d+)\s*[-:]?\s*(.*)$/gm;
    const matches = Array.from(bulkText.matchAll(chapterPattern));
    
    if (matches.length === 0) {
      alert('Hic, tớ không tìm thấy cấu trúc "Chương [số] - " nào ở đầu dòng hết á... (´; ω ;`)\n\nBạn nhớ để "Chương 1 - Tiêu đề" ở một dòng riêng biệt nha!');
      return;
    }

    const results = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const chapterNumber = parseInt(match[1]);
      const title = match[2].trim() || `Chương ${chapterNumber}`;
      
      const startIndex = match.index + match[0].length;
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index : bulkText.length;
      
      const content = bulkText.substring(startIndex, endIndex).trim();

      results.push({
        chapterNumber,
        title,
        content: content || '...', // Default content if empty
        visibility: bulkVisibility
      });
    }
    setParsedChapters(results);
  };

  const handleBulkSubmit = async () => {
    if (parsedChapters.length === 0 || !storyId) return;
    
    setBulkLoading(true);
    try {
      const batch = writeBatch(db);
      const finalChapters = parsedChapters.map(c => ({ ...c, visibility: bulkVisibility }));
      
      for (const chap of finalChapters) {
        const docRef = doc(collection(db, 'stories', storyId, 'chapters'));
        batch.set(docRef, {
          ...chap,
          createdAt: serverTimestamp()
        });
      }
      
      // Update story chapter count
      batch.update(doc(db, 'stories', storyId), {
        chapterCount: increment(parsedChapters.length)
      });

      await batch.commit();

      // Notify once for the whole batch if at least one is public
      if (bulkVisibility === 'public') {
        const firstChapter = finalChapters[0];
        const lastChapter = finalChapters[finalChapters.length - 1];
        const isAnnouncement = story?.categories?.includes('Thông báo');
        
        const message = finalChapters.length === 1 
          ? `vừa có chương ${firstChapter.chapterNumber}: ${firstChapter.title}`
          : `vừa đăng ${finalChapters.length} chương mới (từ ${firstChapter.chapterNumber} đến ${lastChapter.chapterNumber})`;
          
        notificationService.notifyFollowersOfChapter(
          storyId, 
          story?.title || 'Truyện', 
          message, 
          firstChapter.chapterNumber,
          isAnnouncement
        );
      }

      alert(`Hoan hô! Đã đăng thành công ${parsedChapters.length} chương mới rồi nha! ✿`);
      setIsBulkAdding(false);
      setBulkText('');
      setParsedChapters([]);
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi đăng hàng loạt rồi... (´; ω ;`)');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyId) return;

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'stories', storyId, 'chapters', isEditing), {
          ...formData
        });
        alert('Cập nhật chương thành công! ✿');
      } else {
        await addDoc(collection(db, 'stories', storyId, 'chapters'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'stories', storyId), {
          chapterCount: increment(1)
        });
        
        if (formData.visibility === 'public') {
          const isAnnouncement = story?.categories?.includes('Thông báo');
          notificationService.notifyFollowersOfChapter(
            storyId, 
            story?.title || 'Truyện', 
            formData.title, 
            formData.chapterNumber,
            isAnnouncement
          );
        }
        
        alert('Thêm chương mới thành công! ✿');
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra nha... (´; ω ;`)');
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setIsEditing(null);
    setFormData({ 
      title: '', 
      content: '', 
      chapterNumber: chapters.length + 1, 
      visibility: 'public',
      password: ''
    });
  };

  const startEdit = (chapter: any) => {
    setIsEditing(chapter.id);
    setFormData({
      title: chapter.title,
      content: chapter.content,
      chapterNumber: chapter.chapterNumber,
      visibility: chapter.visibility || 'public',
      password: chapter.password || ''
    });
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateVisibility = async (chapterId: string, nextVisibility: string) => {
    try {
      await updateDoc(doc(db, 'stories', storyId!, 'chapters', chapterId), {
        visibility: nextVisibility
      });
    } catch (error) {
      console.error(error);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const handleBulkAction = async (action: 'public' | 'draft' | 'delete') => {
    if (selectedIds.length === 0 || !storyId) return;
    
    setBulkProcessing(true);
    try {
      if (action === 'delete') {
        for (const id of selectedIds) {
          await deleteDoc(doc(db, 'stories', storyId, 'chapters', id));
          await updateDoc(doc(db, 'stories', storyId), {
            chapterCount: increment(-1)
          });
        }
        setConfirmBulkDelete(false);
      } else {
        for (const id of selectedIds) {
          await updateDoc(doc(db, 'stories', storyId, 'chapters', id), {
            visibility: action
          });
        }
      }
      setSelectedIds([]);
      alert("Xong rồi nha! Đã xử lý " + selectedIds.length + " chương thành công! ✿");
    } catch (error) {
      console.error("Bulk action error:", error);
      alert("Có lỗi khi xử lý hàng loạt rồi...");
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === chapters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(chapters.map(c => c.id));
    }
  };

  const updateChapterNumber = async (chapterId: string, newNumber: number) => {
    try {
      await updateDoc(doc(db, 'stories', storyId!, 'chapters', chapterId), {
        chapterNumber: newNumber
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!storyId) return;
    try {
      await deleteDoc(doc(db, 'stories', storyId, 'chapters', id));
      await updateDoc(doc(db, 'stories', storyId), {
        chapterCount: increment(-1)
      });
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Delete chapter error:", error);
      alert("Hic, không xóa được chương này rồi...");
    }
  };

  if (!isSiteAdmin) {
    return <div className="p-20 text-center font-bold italic text-pink-400">Khu vực cấm nha bạn yêu! (◕‿◕✿)</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-12">
        <button 
          onClick={() => navigate('/admin/manage')}
          className="p-4 bg-white rounded-2xl kawaii-shadow text-orange-400 hover:scale-110 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold italic text-[#4A4A4A]">Quản lý chương: {story?.title} ✿</h1>
          <p className="text-[#4A4A4A]/60 font-medium italic">Tỉ mỉ gõ từng chương lôi cuốn...</p>
        </div>
      </div>

      <AnimatePresence>
        {isBulkAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-12 bg-white rounded-[40px] p-8 kawaii-shadow border-4 border-dashed border-blue-200"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <ClipboardList className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold italic text-[#4A4A4A]">Đăng nhiều chương cùng lúc ✿</h3>
              </div>
              <button 
                onClick={() => {
                  setIsBulkAdding(false);
                  setParsedChapters([]);
                  setBulkText('');
                }} 
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-[#4A4A4A]/40" />
              </button>
            </div>

            {parsedChapters.length === 0 ? (
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100 mb-6">
                  <p className="text-sm font-medium text-blue-600 italic mb-4">
                    ✿ Cấu trúc: <span className="font-bold">"Chương [số] - [Tiêu đề]"</span> ở đầu dòng.<br/>
                    Hệ thống sẽ lấy nội dung bên dưới dòng đó cho đến khi gặp chương tiếp theo.
                  </p>
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-bold text-blue-800 uppercase tracking-widest">Trạng thái khi đăng:</label>
                    <select 
                      value={bulkVisibility}
                      onChange={(e) => setBulkVisibility(e.target.value as any)}
                      className="bg-white rounded-xl px-4 py-2 border-2 border-blue-200 text-xs font-bold focus:outline-none"
                    >
                      <option value="public">Công khai ✿</option>
                      <option value="draft">Bản nháp 🔒</option>
                    </select>
                  </div>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Dán nội dung thật dài vào đây nha..."
                  className="w-full bg-soft-yellow/10 rounded-3xl p-8 min-h-[400px] border-2 border-transparent focus:border-blue-200 focus:outline-none font-medium leading-relaxed italic"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleBulkParse}
                    disabled={!bulkText.trim()}
                    className="bg-blue-400 text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl disabled:opacity-50"
                  >
                    Tách chương ✿
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <p className="font-bold italic text-[#4A4A4A]">Tớ đã tìm được <span className="text-blue-500">{parsedChapters.length}</span> chương nè! Xem lại nhé:</p>
                  <button 
                    onClick={() => setParsedChapters([])}
                    className="text-xs font-bold text-blue-400 hover:underline"
                  >
                    Quay lại sửa văn bản
                  </button>
                </div>
                
                <div className="max-h-[500px] overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                  {parsedChapters.map((chap, idx) => (
                    <div key={idx} className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold text-blue-400 bg-blue-50 px-3 py-1 rounded-full uppercase">Chương {chap.chapterNumber}</span>
                        <h4 className="font-bold text-[#4A4A4A]">{chap.title}</h4>
                      </div>
                      <p className="text-xs text-[#4A4A4A]/40 line-clamp-2 italic">{chap.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    onClick={handleBulkSubmit}
                    disabled={bulkLoading}
                    className="bg-[#4A4A4A] text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3 disabled:opacity-50"
                  >
                    {bulkLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {bulkLoading ? 'Đang lưu...' : 'Lưu hết vào kho ✿'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-12 bg-white rounded-[40px] p-8 kawaii-shadow border-4 border-dashed border-accent-yellow/30"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold italic text-[#4A4A4A]">
                {isEditing ? 'Chỉnh sửa chương truyện ✿' : 'Thêm chương mới nè ✿'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-5 h-5 text-[#4A4A4A]/40" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2">Số thứ tự</label>
                  <input 
                    type="number"
                    required
                    value={formData.chapterNumber}
                    onChange={e => setFormData({...formData, chapterNumber: Number(e.target.value)})}
                    className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-bold"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2">Tiêu đề chương</label>
                  <input 
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ví dụ: Lần đầu hội ngộ..."
                    className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2">Trạng thái</label>
                  <select 
                    value={formData.visibility}
                    onChange={e => setFormData({...formData, visibility: e.target.value as any})}
                    className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-bold"
                  >
                    <option value="public">Công khai ✿</option>
                    <option value="draft">Bản nháp 🔒</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2">Mật khẩu (Góc nhỏ ✿)</label>
                  <input 
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Để trống nếu không có..."
                    className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A]/40 uppercase tracking-widest mb-2">Nội dung chương</label>
                <TextEditor 
                  value={formData.content}
                  onChange={(content) => setFormData({...formData, content})}
                  placeholder="Viết nên những dòng cảm xúc nào..."
                  className="bg-soft-yellow/10 rounded-3xl min-h-[400px] border-2 border-transparent focus-within:border-accent-yellow/30 font-medium leading-relaxed italic [&_.ql-editor]:min-h-[300px] [&_.ql-toolbar]:rounded-t-3xl [&_.ql-container]:rounded-b-3xl"
                />
              </div>

              <div className="flex justify-end gap-4">
                <button 
                  type="submit"
                  className="bg-[#4A4A4A] text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3"
                >
                  {isEditing ? <Save className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                  {isEditing ? 'Cập nhật' : 'Đăng chương'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold italic text-[#4A4A4A]">Danh sách chương ({chapters.length})</h2>
          {chapters.length > 0 && (
            <button 
              onClick={toggleSelectAll}
              className="text-xs font-bold text-orange-400 bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 hover:bg-orange-100 transition-all"
            >
              {selectedIds.length === chapters.length ? 'Bỏ chọn hết' : 'Chọn tất cả ✿'}
            </button>
          )}
        </div>
        <div className="flex gap-4">
          {!isAdding && !isBulkAdding && (
            <>
              <button 
                onClick={() => setIsBulkAdding(true)} 
                className="bg-blue-400 text-white px-6 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" /> Đăng hàng loạt
              </button>
              <button 
                onClick={() => {
                  setFormData({ title: '', content: '', chapterNumber: chapters.length + 1, visibility: 'public', password: '' });
                  setIsAdding(true);
                }} 
                className="bg-accent-yellow text-[#4A4A4A] px-6 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Thêm chương mới
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[40px] overflow-hidden kawaii-shadow border-4 border-accent-yellow/10">
        <div className="divide-y divide-accent-yellow/10">
          {chapters.map(chapter => (
            <div key={chapter.id} className={`p-6 flex items-center justify-between hover:bg-soft-yellow/10 transition-all group ${selectedIds.includes(chapter.id) ? 'bg-soft-yellow/20' : ''}`}>
              <div className="flex items-center gap-4">
                <input 
                  type="checkbox"
                  checked={selectedIds.includes(chapter.id)}
                  onChange={() => toggleSelect(chapter.id)}
                  className="w-5 h-5 rounded-lg border-2 border-orange-200 text-orange-400 focus:ring-orange-400 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-400 font-serif">Chương</span>
                  <input 
                    type="number"
                    value={chapter.chapterNumber}
                    onChange={(e) => updateChapterNumber(chapter.id, Number(e.target.value))}
                    className="w-12 bg-orange-50 text-orange-400 font-bold px-2 py-1 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <span className="font-bold text-[#4A4A4A]">{chapter.title}</span>
                {chapter.visibility === 'draft' && (
                  <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Lock className="w-2 h-2" /> Ẩn
                  </span>
                )}
              </div>
              <div className="flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-all">
                <select
                  value={chapter.visibility || 'public'}
                  onChange={(e) => updateVisibility(chapter.id, e.target.value)}
                  className={`p-2 rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all border-2 ${
                    chapter.visibility === 'draft' 
                      ? 'bg-gray-50 text-gray-400 border-gray-100' 
                      : 'bg-green-50 text-green-400 border-green-100'
                  }`}
                >
                  <option value="public">Công khai ✿</option>
                  <option value="draft">Bản nháp 🔒</option>
                </select>
                <button onClick={() => startEdit(chapter)} className="p-3 bg-blue-50 text-blue-400 rounded-xl hover:scale-110 transition-all">
                  <Edit3 className="w-5 h-5" />
                </button>
                <button onClick={() => setConfirmDeleteId(chapter.id)} className="p-3 bg-pink-50 text-pink-400 rounded-xl hover:scale-110 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {chapters.length === 0 && !loading && (
            <div className="p-20 text-center opacity-30">
              <Book className="w-12 mx-auto mb-4" />
              <p className="font-bold italic">Chưa có chương nào hết trơn á!</p>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#4A4A4A]/90 backdrop-blur-md px-8 py-5 rounded-[32px] shadow-2xl flex items-center gap-8 z-50 border border-white/10"
          >
            <div className="text-white">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Đã chọn</p>
              <p className="font-bold italic">{selectedIds.length} chương truyện ✿</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div className="flex gap-3">
              <button 
                onClick={() => handleBulkAction('public')}
                disabled={bulkProcessing}
                className="bg-green-400 text-white px-5 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
              >
                <Globe className="w-4 h-4" /> Công khai
              </button>
              <button 
                onClick={() => handleBulkAction('draft')}
                disabled={bulkProcessing}
                className="bg-gray-500 text-white px-5 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Ẩn đi
              </button>
              <button 
                onClick={() => setConfirmBulkDelete(true)}
                disabled={bulkProcessing}
                className="bg-pink-400 text-white px-5 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Xóa sạch
              </button>
            </div>
            {bulkProcessing && (
              <div className="absolute inset-0 bg-black/20 rounded-[32px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Chắc chắn xóa chứ? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Hành động này không thể hoàn tác đâu nha...</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Bỏ qua
                </button>
                <button 
                  onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
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
        {confirmBulkDelete && (
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
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa {selectedIds.length} chương? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Bạn có chắc muốn xóa hàng loạt không nè?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmBulkDelete(false)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Thôi nha
                </button>
                <button 
                  onClick={() => handleBulkAction('delete')}
                  className="flex-1 py-4 bg-pink-400 rounded-2xl font-bold text-white shadow-lg hover:bg-pink-500"
                >
                  Xóa hết!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
