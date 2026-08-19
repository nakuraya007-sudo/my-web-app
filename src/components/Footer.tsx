import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-white border-t-4 border-dashed border-accent-yellow/20 py-16 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-10 w-12 h-12 bg-kawaii-pink/10 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-16 h-16 bg-orange-400/5 rounded-full blur-xl animate-pulse delay-700"></div>
      <div className="absolute top-1/2 left-4 -translate-y-1/2 opacity-10 pointer-events-none animate-bounce">
        <img src="https://cdn-icons-png.flaticon.com/512/2663/2663067.png" alt="cat" className="w-20 rotate-12" />
      </div>
      <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-10 pointer-events-none animate-bounce [animation-delay:1s]">
        <img src="https://cdn-icons-png.flaticon.com/512/2663/2663067.png" alt="cat" className="w-20 -rotate-12 scale-x-[-1]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold font-serif text-[#4A4A4A] italic mb-4">YACchan ✿</h2>
            <p className="text-[#4A4A4A]/50 max-w-sm italic font-medium">
              Cảm ơn bạn đã ghé thăm góc nhỏ của tớ! (◕‿◕) ♡ ✿
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex gap-4">
              <a 
                href="mailto:nakuraya007@gmail.com" 
                className="w-12 h-12 bg-soft-yellow/20 rounded-2xl flex items-center justify-center text-orange-400 hover:scale-110 transition-all border-2 border-transparent hover:border-orange-100"
                title="Gửi mail cho tớ nè"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
              <a 
                href="https://web.facebook.com/gerald.keir" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 bg-kawaii-pink/10 rounded-2xl flex items-center justify-center text-pink-400 hover:scale-110 transition-all border-2 border-transparent hover:border-pink-100"
                title="Ghé qua Facebook chơi nha"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-accent-yellow/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A4A4A]/30">
          <p>© {new Date().getFullYear()} YACchan. Made with love ✿</p>
          <div className="flex gap-6">
            <span>Chào mừng bạn về nhà</span>
            <span>✿</span>
            <span>Hẹn gặp lại nha</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
