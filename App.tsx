import React, { useRef, useEffect } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import Visualizer from './components/Visualizer';
import { ConnectionState, ChatMessage } from './types';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-2.9 5.69A7 7 0 0 1 12 19a7 7 0 0 1-5.1-12.1"/></svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
);

const App: React.FC = () => {
  const { connectionState, connect, disconnect, analyser, chatHistory } = useGeminiLive();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const toggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 bg-slate-900 border-b border-slate-800 flex items-center px-6 shadow-md z-10">
        <div className="flex items-center gap-3 text-usaf-blue">
          <ShieldIcon />
          <h1 className="text-xl font-bold tracking-tight text-white">
            DAW <span className="text-gray-400 font-normal">| Software Engineering Assistant</span>
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
           <span className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full ${
               connectionState === ConnectionState.CONNECTED ? 'bg-green-900/30 text-green-400 border border-green-800' : 
               connectionState === ConnectionState.ERROR ? 'bg-red-900/30 text-red-400 border border-red-800' :
               'bg-slate-800 text-slate-400 border border-slate-700'
           }`}>
               <span className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
               {connectionState}
           </span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Desktop only) */}
        <aside className="hidden md:flex w-64 flex-col bg-slate-900/50 border-r border-slate-800 p-4 gap-4">
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">Mission Context</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are interacting with a specialized Defense Acquisition bot. Topics include:
            </p>
            <ul className="text-xs text-slate-400 mt-2 list-disc list-inside space-y-1">
                <li>DoDI 5000.87 (Software Pathway)</li>
                <li>DevSecOps Implementation</li>
                <li>Agile Metrics & Contracting</li>
                <li>ATO & Cybersecurity</li>
            </ul>
          </div>
          
          <div className="mt-auto">
             <div className="text-[10px] text-slate-600 text-center">
                 UNCLASSIFIED // FOR OFFICIAL USE ONLY
             </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col relative max-w-4xl mx-auto w-full">
            
            {/* Messages */}
            <div 
                ref={scrollRef} 
                className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin"
            >
                {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 select-none">
                        <ShieldIcon />
                        <p className="mt-4 text-lg font-medium">Ready for briefing</p>
                        <p className="text-sm">Press the microphone to begin.</p>
                    </div>
                )}
                
                {chatHistory.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-usaf-blue flex items-center justify-center flex-shrink-0 mt-1">
                                <BotIcon />
                            </div>
                        )}
                        
                        <div className={`
                            max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm
                            ${msg.role === 'user' 
                                ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700' 
                                : 'bg-slate-900 text-slate-300 rounded-tl-none border border-slate-800'}
                        `}>
                            {msg.text}
                        </div>
                        
                         {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                                <UserIcon />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Sticky Control Area */}
            <div className="flex-none p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-20">
                <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
                    
                    {/* Visualizer */}
                    <div className="w-full relative group">
                        <Visualizer analyser={analyser} isActive={connectionState === ConnectionState.CONNECTED} />
                        <div className="absolute top-2 right-2 text-[10px] text-slate-500 font-mono bg-black/40 px-2 rounded">
                            AUDIO_IN: 16kHz
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleConnection}
                            disabled={connectionState === ConnectionState.CONNECTING}
                            className={`
                                w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95
                                ${connectionState === ConnectionState.CONNECTED 
                                    ? 'bg-red-500/90 hover:bg-red-600 shadow-red-500/20 animate-pulse' 
                                    : 'bg-usaf-blue hover:bg-blue-700 shadow-blue-500/20'}
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            {connectionState === ConnectionState.CONNECTED ? (
                                <MicOffIcon />
                            ) : (
                                <MicIcon />
                            )}
                        </button>
                    </div>

                    {connectionState === ConnectionState.DISCONNECTED && (
                        <p className="text-xs text-slate-500">
                            Click microphone to initiate secure voice session
                        </p>
                    )}
                </div>
            </div>

        </main>
      </div>
    </div>
  );
};

export default App;