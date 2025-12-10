import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { ConnectionState, ChatMessage } from '../types';

export const useGeminiLive = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const currentTranscriptRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  // Cleanup function
  const disconnect = useCallback(() => {
    // Stop all audio sources
    audioQueueRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    audioQueueRef.current.clear();

    // Close contexts
    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close();
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close();
    }
    
    // Stop tracks
    if (inputSourceRef.current) {
        inputSourceRef.current.mediaStream.getTracks().forEach(track => track.stop());
    }

    // Reset State
    setConnectionState(ConnectionState.DISCONNECTED);
    setAnalyser(null);
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    sessionRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      
      // 1. Setup Audio Contexts
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }});
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // 2. Setup Analyser for Visualization
      const analyserNode = outputAudioContextRef.current.createAnalyser();
      analyserNode.fftSize = 256;
      setAnalyser(analyserNode);

      // 3. Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `
        You are a highly specialized AI assistant for the United States Defense Acquisition Workforce, specifically serving the Software Engineering functional area. 
        Your persona is professional, secure, and knowledgeable, similar to a senior technical advisor in the DoD.
        
        Key Knowledge Areas:
        1. Defense Acquisition Guidebook (DAG) - Chapter 3 (Systems Engineering) and software specifics.
        2. DoD Instruction 5000.02 (Operation of the Adaptive Acquisition Framework).
        3. DoDI 5000.87 (Operation of the Software Acquisition Pathway).
        4. DevSecOps fundamentals, CI/CD pipelines, and Containerization in a DoD context.
        5. Agile methodologies (Scrum, SAFe) as applied to government contracts.
        
        Guidelines:
        - Use precise DoD acronyms (e.g., PM, PEO, OTA, FAR, DFARS) but be ready to explain them.
        - Prioritize security and "shift-left" mentality in all answers.
        - Be concise. This is a voice interface; long monologues are hard to follow. Keep responses under 4 sentences unless asked for detail.
        - If asked about classified info, politely decline and state you operate on an unclassified system.
      `;

      // 4. Connect to Live API
      sessionRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } // Fenrir sounds authoritative/deep
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Start streaming input
            if (!inputAudioContextRef.current) return;
            
            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionRef.current?.then(session => {
                 session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            inputSourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const { serverContent } = msg;

            // Handle Transcripts
            if (serverContent?.modelTurn?.parts?.[0]?.text || serverContent?.outputTranscription) {
               // Usually model text comes via outputTranscription in Live API
               const text = serverContent?.outputTranscription?.text || serverContent?.modelTurn?.parts?.[0]?.text;
               if (text) {
                   currentTranscriptRef.current.model += text;
                   setChatHistory(prev => {
                       const last = prev[prev.length - 1];
                       if (last && last.role === 'assistant' && !last.isComplete) {
                           return [...prev.slice(0, -1), { ...last, text: currentTranscriptRef.current.model }];
                       }
                       return [...prev, {
                           id: Date.now().toString(),
                           role: 'assistant',
                           text: currentTranscriptRef.current.model,
                           timestamp: new Date(),
                           isComplete: false
                       }];
                   });
               }
            }
            
            if (serverContent?.inputTranscription) {
                const text = serverContent.inputTranscription.text;
                if (text) {
                     currentTranscriptRef.current.user += text;
                     // We don't usually display partial user text in real-time history to avoid jitter, 
                     // but we update it when turn is complete.
                }
            }

            if (serverContent?.turnComplete) {
                // Finalize the chat bubbles
                setChatHistory(prev => {
                    // Update user message if we have one pending
                    let newHistory = [...prev];
                    if (currentTranscriptRef.current.user.trim()) {
                         const userMsg: ChatMessage = {
                             id: 'user-' + Date.now(),
                             role: 'user',
                             text: currentTranscriptRef.current.user,
                             timestamp: new Date(),
                             isComplete: true
                         };
                         // Insert user message before the last assistant message if exists, or append
                         // However, typically user speaks, then model speaks.
                         // Simple approach: append user message if it's new
                         newHistory.push(userMsg);
                    }
                    
                    // Mark assistant message as complete
                    if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'assistant') {
                         newHistory[newHistory.length - 1].isComplete = true;
                    } else if (currentTranscriptRef.current.model.trim()) {
                         newHistory.push({
                             id: 'model-' + Date.now(),
                             role: 'assistant',
                             text: currentTranscriptRef.current.model,
                             timestamp: new Date(),
                             isComplete: true
                         });
                    }
                    return newHistory.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
                });

                currentTranscriptRef.current = { user: '', model: '' };
            }


            // Handle Audio
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
               const ctx = outputAudioContextRef.current;
               const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), ctx);
               
               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(analyserNode).connect(ctx.destination);
               
               // Schedule
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               
               audioQueueRef.current.add(source);
               source.onended = () => {
                   audioQueueRef.current.delete(source);
               };
            }

            // Handle Interruption
            if (serverContent?.interrupted) {
                audioQueueRef.current.forEach(s => {
                    try { s.stop(); } catch(e) {}
                });
                audioQueueRef.current.clear();
                nextStartTimeRef.current = 0;
                currentTranscriptRef.current.model = ''; // Reset partial model text
            }
          },
          onclose: () => {
             setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (e) => {
             console.error("Gemini Live Error", e);
             setConnectionState(ConnectionState.ERROR);
             disconnect();
          }
        }
      });

    } catch (error) {
      console.error("Connection failed", error);
      setConnectionState(ConnectionState.ERROR);
    }
  }, [disconnect]);

  useEffect(() => {
      // Cleanup on unmount
      return () => disconnect();
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    analyser,
    chatHistory
  };
};