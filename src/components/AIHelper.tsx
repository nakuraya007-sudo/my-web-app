import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AIHelper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "Bạn là một trợ lý đắc lực cho các Editor truyện. Nhiệm vụ của bạn là giúp họ chăm chút câu chữ, kiểm tra ngữ pháp, gợi ý từ ngữ hay hơn, hoặc tóm tắt ý chính của văn bản bằng tiếng Việt thật tinh tế và trau chuốt.",
        },
      });
      setResponse(result.text || 'Không có phản hồi từ AI.');
    } catch (error) {
      console.error(error);
      setResponse('Đã có lỗi xảy ra. Vui lòng kiểm tra lại API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-8 z-[60] bg-[#4A4A4A] text-white p-5 rounded-[24px] kawaii-shadow hover:scale-110 transition-all group"
      >
        <Sparkles className="w-7 h-7" />
        <span className="absolute right-full mr-4 bg-white text-[#4A4A4A] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap kawaii-shadow border-2 border-accent-yellow/20">
          Trợ lý Editor AI ✿
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 right-8 z-[70] w-80 md:w-96 bg-white rounded-[40px] kawaii-shadow border-4 border-accent-yellow/10 overflow-hidden"
          >
            <div className="bg-soft-yellow/80 backdrop-blur-md p-6 flex justify-between items-center border-b-2 border-accent-yellow/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                </div>
                <span className="font-bold text-[#4A4A4A] italic">Gợi ý từ Novella ✿</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                <X className="w-5 h-5 text-[#4A4A4A]/40" />
              </button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto">
              {response ? (
                <div className="mb-4 text-sm leading-relaxed text-[#4A4A4A]/80 whitespace-pre-wrap bg-soft-yellow/20 p-5 rounded-3xl border-2 border-accent-yellow/10 italic">
                  {response}
                </div>
              ) : (
                <p className="text-sm text-[#4A4A4A]/40 mb-4 text-center py-12 italic font-medium">
                  Chào Editor! Bạn cần tớ hỗ trợ trau chuốt câu chữ nào không? (◕‿◕✿)
                </p>
              )}
            </div>

            <div className="p-6 border-t border-accent-yellow/10 flex gap-3 bg-gray-50/50">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: Giúp tớ diễn đạt đoạn này hay hơn..."
                className="flex-grow text-sm border-2 border-accent-yellow/20 rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-accent-yellow/20 bg-white font-medium"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="bg-[#4A4A4A] text-white p-4 rounded-2xl disabled:opacity-20 hover:scale-105 transition-all shadow-lg shrink-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
