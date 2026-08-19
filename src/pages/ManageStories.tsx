import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Book, Edit3, Trash2, Plus, Eye, Lock, Globe, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const ManageStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isSiteAdmin) return;

    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setStories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSiteAdmin]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'stories', id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Delete story error:", error);
      alert("Hic, không xóa được bộ truyện này rồi...");
    }
  };

  const updateVisibility = async (id: string, nextVisibility: string) => {
    try {
      await updateDoc(doc(db, 'stories', id), {
        visibility: nextVisibility
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (!isSiteAdmin) {
    return <div className="p-20 text-center font-bold italic text-pink-400">Khu vực cấm nha bạn yêu! (◕‿◕✿)</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold italic text-[#4A4A4A]">Quản lý kho truyện ✿</h1>
          <p className="text-[#4A4A4A]/60 font-medium italic">Nơi chăm chút cho từng bộ truyện tâm huyết...</p>
        </div>
        <Link to="/admin/create" className="bg-[#4A4A4A] text-white px-8 py-4 rounded-3xl font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2">
          <Plus className="w-5 h-5" /> Thêm truyện mới
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map(story => (
          <motion.div 
            layout
            key={story.id} 
            className="bg-white rounded-[40px] p-6 kawaii-shadow border-4 border-accent-yellow/10 group relative"
          >
            <div className="flex gap-4 mb-6">
              <div className="w-20 h-28 rounded-2xl overflow-hidden shrink-0 border-2 border-soft-yellow">
                <img src={story.coverImage} className="w-full h-full object-cover" alt="cover" />
              </div>
              <div className="flex-grow min-w-0">
                <h3 className="font-bold text-[#4A4A4A] truncate text-lg mb-1">{story.title}</h3>
                <p className="text-xs text-[#4A4A4A]/40 font-bold uppercase tracking-widest mb-3">{story.authorName}</p>
                <div className="flex items-center gap-2">
                  {story.visibility === 'public' ? (
                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase bg-green-50 text-green-500 px-2 py-1 rounded-lg">
                      <Globe className="w-2 h-2" /> Công khai
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase bg-gray-50 text-gray-500 px-2 py-1 rounded-lg">
                      <Lock className="w-2 h-2" /> Bản nháp
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-accent-yellow/10">
              <Link 
                to={`/admin/chapters/${story.id}`}
                className="flex items-center justify-center gap-2 py-3 bg-soft-yellow/20 rounded-2xl text-xs font-bold text-[#4A4A4A] hover:bg-soft-yellow/40 transition-all font-serif italic"
              >
                <List className="w-4 h-4" /> Quản lý chương ✿
              </Link>
              <select
                value={story.visibility}
                onChange={(e) => updateVisibility(story.id, e.target.value)}
                className={`py-3 px-2 rounded-2xl text-[10px] uppercase tracking-wider font-bold transition-all appearance-none text-center cursor-pointer ${
                  story.visibility === 'public' 
                    ? 'bg-green-50 text-green-500 border-2 border-green-100' 
                    : 'bg-gray-50 text-gray-400 border-2 border-gray-100'
                }`}
              >
                <option value="public">Công khai ✿</option>
                <option value="draft">Bản nháp 🔒</option>
              </select>
            </div>
            
            <div className="absolute -top-3 -right-3 flex gap-2">
              <Link to={`/admin/edit/${story.id}`} className="bg-white p-3 rounded-2xl text-blue-400 kawaii-shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110">
                <Edit3 className="w-5 h-5" />
              </Link>
              <button onClick={() => setConfirmDeleteId(story.id)} className="bg-white p-3 rounded-2xl text-pink-400 kawaii-shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
        {stories.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center opacity-30">
            <Book className="w-20 mx-auto mb-6" />
            <p className="text-2xl font-bold italic">Chưa có bộ truyện nào hết trơn á!</p>
          </div>
        )}
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
              <h3 className="text-xl font-bold text-[#4A4A4A] mb-4">Xóa cả bộ truyện? ✿</h3>
              <p className="text-[#4A4A4A]/60 italic mb-8">Tất cả chương cũ cũng sẽ mất đó, bạn chắc chứ? (´; ω ;`)</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-[#4A4A4A]/60 hover:bg-gray-200"
                >
                  Thôi nha
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
    </div>
  );
};
