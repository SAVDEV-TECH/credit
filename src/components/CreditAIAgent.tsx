"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, User, X, Loader2, Check, Mic, Square, Wallet, ArrowRightLeft, Calendar, History } from "lucide-react";
import toast from "react-hot-toast";

interface DebtData {
  customerName: string;
  amountOwed: number;
  deposited: number;
  balance: number;
  description: string;
  date: string;
  customerContact?: string | null;
  agreedPaymentDate?: string | null;
}

export default function CreditAIAgent({ onDebtParsed }: { 
  onDebtParsed: (data: DebtData) => void
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<DebtData | null>(null);
  const [step, setStep] = useState<"input" | "review">("input");
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        processMedia(blob, "audio");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processMedia = async (blob?: Blob, type: "audio" | "text" = "text") => {
    setLoading(true);
    try {
      let body: any = { message: input };
      
      if (type === "audio" && blob) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        await new Promise((resolve) => (reader.onloadend = resolve));
        body.audio = (reader.result as string).split(",")[1];
        body.mimeType = blob.type;
      }
        
      const res = await fetch("/api/ai/parse-debt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setParsedData(data);
      setStep("review");
    } catch (err: any) {
      toast.error(err.message || "Failed to process input");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => processMedia();

  const handleConfirm = () => {
    if (parsedData) {
      onDebtParsed(parsedData);
      setIsOpen(false);
      setStep("input");
      setParsedData(null);
      setInput("");
      toast.success("Debt added to ledger!");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, y: 40, filter: "blur(10px)" }}
            className="mb-4 sm:mb-6 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[90vh] bg-white/80 dark:bg-gray-950/80 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-gray-800/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white relative flex-shrink-0">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <History size={120} />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0">
                    <Wallet size={18} className="sm:w-5 sm:h-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-base sm:text-lg tracking-tight leading-tight truncate">Mog Ledger Agent</h3>
                    <p className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-emerald-100 opacity-80 line-clamp-1">Credit & Debt Assistant v1.0</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-all flex-shrink-0 ml-2"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {step === "input" ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 sm:p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30">
                    <p className="text-[11px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      {isRecording ? "Listening to debt details..." : "Speak or type debt details (e.g., 'Darty owes 5k for rice, his number is 08012345678 and he will pay next week')."}
                    </p>
                  </div>
                  
                  <div className="relative group">
                    {isRecording ? (
                      <div className="w-full h-40 bg-gray-50/50 dark:bg-gray-900/50 rounded-3xl border border-emerald-500 flex flex-col items-center justify-center gap-4">
                        <div className="flex items-center gap-1 h-12">
                          {[...Array(6)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [10, 40, 10] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                              className="w-1.5 bg-emerald-500 rounded-full"
                            />
                          ))}
                        </div>
                        <button
                          onClick={stopRecording}
                          className="px-6 py-2 bg-red-500 text-white rounded-full font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20"
                        >
                          <Square size={14} fill="white" /> Stop
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Who owes you? How much? Phone number? Expected payment date?"
                          className="w-full h-40 p-5 bg-gray-50/50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm transition-all resize-none dark:text-white"
                        />
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                           <button
                            onClick={startRecording}
                            className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
                            title="Speak"
                          >
                            <Mic size={20} />
                          </button>
                           <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center min-w-[44px]"
                          >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-emerald-50/30 dark:bg-emerald-900/5 p-5 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-800/50">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                        <User size={28} />
                      </div>
                      <div>
                        <h4 className="font-black text-xl text-gray-900 dark:text-white">{parsedData?.customerName}</h4>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                          <Calendar size={12} />
                          {parsedData?.date ? new Date(parsedData.date).toLocaleDateString() : "Today"}
                        </div>
                        {parsedData?.customerContact && (
                          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                            Contact: {parsedData.customerContact}
                          </div>
                        )}
                        {parsedData?.agreedPaymentDate && (
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            Pays on: {new Date(parsedData.agreedPaymentDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-bold text-gray-400 uppercase">Total Amount</span>
                        <span className="font-black text-gray-900 dark:text-white">₦{parsedData?.amountOwed?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-bold text-gray-400 uppercase">Deposited</span>
                        <span className="font-black text-emerald-600">₦{parsedData?.deposited?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/20">
                        <span className="text-xs font-bold uppercase opacity-80">Remaining Balance</span>
                        <span className="font-black text-2xl">₦{parsedData?.balance?.toLocaleString()}</span>
                      </div>
                    </div>

                    {parsedData?.description && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 italic">"{parsedData.description}"</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep("input")}
                      className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Retry
                    </button>
                    <button 
                      onClick={handleConfirm}
                      className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> Confirm Entry
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white rounded-full shadow-[0_16px_32px_-8px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-110 active:scale-90 transition-all group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <ArrowRightLeft size={28} className="relative z-10 group-hover:rotate-180 transition-transform duration-500" />
      </button>
    </div>
  );
}
