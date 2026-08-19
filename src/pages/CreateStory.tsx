import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TextEditor } from '../components/TextEditor';
import { motion } from 'motion/react';
import { Book, Image as ImageIcon, Send, X, Plus, AlertCircle, Info, Loader2, Save } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const CreateStory = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [formData, setFormData] = useState({
    title: '',
    hanViet: '',
    description: '',
    originalAuthor: '',
    coverImage: '',
    bannerImage: '',
    warning: '',
    info: '',
    categories: [''],
    perspective: '',
    achievements: [''],
    status: 'ongoing' as const,
    visibility: 'public' as const,
    introduction: ''
  });

  const addCategory = () => setFormData({ ...formData, categories: [...formData.categories, ''] });
  const updateCategory = (val: string, index: number) => {
    const cats = [...formData.categories];
    cats[index] = val;
    setFormData({ ...formData, categories: cats });
  };

  const addAchievement = () => setFormData({ ...formData, achievements: [...formData.achievements, ''] });
  const updateAchievement = (val: string, index: number) => {
    const achievements = [...formData.achievements];
    achievements[index] = val;
    setFormData({ ...formData, achievements });
  };

  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const compressAndEncodeImage = (file: File, type: 'coverImage' | 'bannerImage') => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if too large
          const maxDim = type === 'coverImage' ? 800 : 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim;
              width = maxDim;
            } else {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Quality adjustment to stay under Firestore 1MB limit
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, [type]: dataUrl }));
          resolve();
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'coverImage' | 'bannerImage') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Hic, ảnh nặng quá rồi (trên 5MB), bạn chọn ảnh nhẹ hơn chút nha! (´; ω ;`)');
      return;
    }

    setIsProcessing(type);
    try {
      await compressAndEncodeImage(file, type);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Không xử lý được ảnh này rồi... (´; ω ;`)');
    } finally {
      setIsProcessing(null);
    }
  };

  useEffect(() => {
    if (id) {
      const fetchStory = async () => {
        try {
          const snap = await getDoc(doc(db, 'stories', id));
          if (snap.exists()) {
            const data = snap.data();
            setFormData({
              title: data.title || '',
              hanViet: data.hanViet || '',
              description: data.description || '',
              originalAuthor: data.originalAuthor || '',
              coverImage: data.coverImage || '',
              bannerImage: data.bannerImage || '',
              warning: data.warning || '',
              info: data.info || '',
              categories: [...(data.categories || []), ...(data.tags || [])].filter((v, i, a) => a.indexOf(v) === i && v.trim()),
              perspective: data.perspective || '',
              achievements: data.achievements?.length ? data.achievements : [''],
              status: data.status || 'ongoing',
              visibility: data.visibility || 'public',
              introduction: data.introduction || ''
            });
          }
        } catch (error) {
          console.error(error);
        } finally {
          setInitialLoading(false);
        }
      };
      fetchStory();
    }
  }, [id]);

  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return <div className="p-20 text-center font-bold italic text-pink-400">Hì hì, chỗ này chỉ dành cho chủ nhân của góc nhỏ thôi nha! {'(◕‿◕✿)'}</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const storyData = {
        ...formData,
        coverImage: formData.coverImage || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=800',
        bannerImage: formData.bannerImage || '',
        categories: formData.categories.filter(c => c.trim()),
        tags: [], // Tags no longer used separately
        achievements: formData.achievements.filter(a => a.trim()),
      };

      if (id) {
        await updateDoc(doc(db, 'stories', id), {
          ...storyData,
          updatedAt: serverTimestamp()
        });
        alert('Cập nhật truyện thành công! ✿');
      } else {
        await addDoc(collection(db, 'stories'), {
          ...storyData,
          authorId: user.uid,
          authorName: user.displayName || 'Editor',
          views: 0,
          rating: 5.0,
          chapterCount: 0,
          createdAt: serverTimestamp()
        });
        alert('Truyện đã được tạo thành công! ✿');
      }
      navigate('/admin/manage');
    } catch (error) {
      console.error('Error saving story:', error);
      alert('Có lỗi xảy ra rồi nè... (´; ω ;`)');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-20 text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-orange-400" />
        <p className="mt-4 font-bold italic text-[#4A4A4A]/40">Đang tìm truyện trong kho... ✿</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-12 text-center">
        <div className="inline-block p-4 bg-soft-yellow rounded-[32px] kawaii-shadow mb-6">
          <Book className="w-10 h-10 text-orange-400" />
        </div>
        <h1 className="text-4xl font-bold italic text-[#4A4A4A]">
          {id ? 'Chỉnh sửa truyện ✿' : 'Thêm truyện mới cho góc nhỏ'}
        </h1>
        <p className="text-[#4A4A4A]/60 font-medium italic mt-2">Chăm chút từng câu chữ thật kĩ nha bạn yêu! ✿</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[40px] p-8 md:p-12 kawaii-shadow border-4 border-accent-yellow/10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Tên truyện</label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Ví dụ: Nắng ấm bên hiên nhà..." 
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Tên Hán Việt</label>
              <input 
                type="text" 
                value={formData.hanViet}
                onChange={e => setFormData({...formData, hanViet: e.target.value})}
                placeholder="Tên Hán Việt nè..." 
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Tác giả gốc</label>
              <input 
                type="text" 
                value={formData.originalAuthor}
                onChange={e => setFormData({...formData, originalAuthor: e.target.value})}
                placeholder="Tên tác giả gốc nè..." 
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Góc nhìn (Chủ thụ/công...)</label>
              <input 
                type="text" 
                value={formData.perspective}
                onChange={e => setFormData({...formData, perspective: e.target.value})}
                placeholder="Ví dụ: Chủ thụ..." 
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Trạng thái</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-bold"
              >
                <option value="ongoing">Đang edit (Ongoing)</option>
                <option value="completed">Đã hoàn (Completed)</option>
                <option value="dropped">Tạm ngưng (Dropped)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Hiển thị</label>
              <select 
                value={formData.visibility}
                onChange={e => setFormData({...formData, visibility: e.target.value as any})}
                className="w-full bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-bold"
              >
                <option value="public">Công khai ✿</option>
                <option value="draft">Bản nháp (Ẩn) 🔒</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Bìa truyện ✿</label>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={formData.coverImage.startsWith('data:') ? 'Ảnh tải lên từ máy...' : formData.coverImage}
                    onChange={e => setFormData({...formData, coverImage: e.target.value})}
                    placeholder="Dán link ảnh bìa vào đây..." 
                    className="flex-1 bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium text-xs"
                  />
                  <label className="cursor-pointer bg-white border-2 border-orange-200 text-orange-400 px-6 py-4 rounded-2xl flex items-center gap-2 hover:bg-orange-50 transition-all font-bold text-xs shrink-0">
                    {isProcessing === 'coverImage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    Tải lên
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'coverImage')} />
                  </label>
                </div>
                {formData.coverImage && (
                  <div className="relative w-24 aspect-[3/4] rounded-2xl overflow-hidden border-4 border-accent-yellow/20 group">
                    <img src={formData.coverImage} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, coverImage: ''})}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Ảnh Banner (Nếu có) ✿</label>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={formData.bannerImage.startsWith('data:') ? 'Ảnh tải lên từ máy...' : formData.bannerImage}
                    onChange={e => setFormData({...formData, bannerImage: e.target.value})}
                    placeholder="Dán link ảnh banner ngang vào đây..." 
                    className="flex-1 bg-soft-yellow/20 rounded-2xl px-6 py-4 border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium text-xs"
                  />
                  <label className="cursor-pointer bg-white border-2 border-blue-200 text-blue-400 px-6 py-4 rounded-2xl flex items-center gap-2 hover:bg-blue-50 transition-all font-bold text-xs shrink-0">
                    {isProcessing === 'bannerImage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    Tải lên
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'bannerImage')} />
                  </label>
                </div>
                {formData.bannerImage && (
                  <div className="relative w-full h-24 rounded-2xl overflow-hidden border-4 border-blue-100 group">
                    <img src={formData.bannerImage} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, bannerImage: ''})}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Thể loại (Gồm cả tag)</label>
            <div className="flex flex-wrap gap-2">
              {formData.categories.map((cat, i) => (
                <input 
                  key={i}
                  type="text" 
                  value={cat}
                  onChange={e => updateCategory(e.target.value, i)}
                  className="w-24 bg-white border-2 border-accent-yellow/20 rounded-xl px-3 py-2 text-xs font-bold"
                  placeholder="Thể loại..."
                />
              ))}
              <button type="button" onClick={addCategory} className="p-2 bg-accent-yellow text-[#4A4A4A] rounded-xl"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Danh hiệu</label>
            <div className="flex flex-wrap gap-2">
              {formData.achievements.map((ach, i) => (
                <input 
                  key={i}
                  type="text" 
                  value={ach}
                  onChange={e => updateAchievement(e.target.value, i)}
                  className="w-24 bg-white border-2 border-blue-200 rounded-xl px-3 py-2 text-xs font-bold"
                  placeholder="Danh hiệu..."
                />
              ))}
              <button type="button" onClick={addAchievement} className="p-2 bg-blue-400 text-white rounded-xl"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-pink-400" /> Cảnh báo
            </label>
            <textarea 
              value={formData.warning}
              onChange={e => setFormData({...formData, warning: e.target.value})}
              placeholder="Cần lưu ý gì khi đọc truyện không?..." 
              className="w-full bg-kawaii-pink/5 rounded-2xl p-6 min-h-[100px] border-2 border-transparent focus:border-kawaii-pink/30 focus:outline-none font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" /> Thông tin thêm
            </label>
            <textarea 
              value={formData.info}
              onChange={e => setFormData({...formData, info: e.target.value})}
              placeholder="Nguồn truyện, lịch đăng,..." 
              className="w-full bg-blue-50/30 rounded-2xl p-6 min-h-[100px] border-2 border-transparent focus:border-blue-200 focus:outline-none font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Tóm tắt nội dung</label>
          <textarea 
            required
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder="Kể chút về truyện đi nào..." 
            className="w-full bg-soft-yellow/20 rounded-[32px] p-8 min-h-[150px] border-2 border-transparent focus:border-accent-yellow/50 focus:outline-none font-medium italic"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-[#4A4A4A]/60 uppercase tracking-widest mb-2">Sơ lược (Giới thiệu câu chuyện)</label>
          <TextEditor 
            value={formData.introduction}
            onChange={(content) => setFormData({...formData, introduction: content})}
            placeholder="Bạn có thể chèn ảnh bằng toolbar nha ✿" 
            className="bg-soft-yellow/5 rounded-[32px] min-h-[300px] border-2 border-dashed border-accent-yellow/20 focus-within:border-accent-yellow/50 font-medium [&_.ql-editor]:min-h-[200px] [&_.ql-toolbar]:rounded-t-3xl [&_.ql-container]:rounded-b-3xl"
          />
        </div>

        <div className="pt-8 flex justify-center">
          <button 
            type="submit"
            disabled={loading}
            className="bg-[#4A4A4A] text-white px-16 py-5 rounded-3xl font-bold uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-2xl flex items-center gap-3 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <>Đang lưu... <Loader2 className="w-5 h-5 animate-spin" /></>
            ) : (
              <>
                {id ? 'Cập nhật truyện' : 'Lưu truyện'} ✿ 
                {id ? <Save className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
