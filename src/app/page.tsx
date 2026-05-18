"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  Plus,
  Bell,
  MessageCircle,
  Volume2,
  Smartphone
} from "lucide-react";
import CreditAIAgent from "@/components/CreditAIAgent";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from "firebase/auth";
import toast from "react-hot-toast";

interface DebtRecord {
  id?: string;
  customerName: string;
  amountOwed: number;
  deposited: number;
  balance: number;
  description: string;
  date: string;
  status: "pending" | "paid" | "overdue";
  customerContact?: string | null;
  agreedPaymentDate?: string | null;
  remindedAt?: string | null;
}

export default function CreditsPage() {
  const [records, setRecords] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        fetchRecords();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchRecords = async () => {
    try {
      const q = query(collection(db, "credits"), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DebtRecord[];
      setRecords(data);
      checkAutomatedReminders(data);
    } catch (error) {
      console.error("Error fetching records:", error);
      // Fallback mock data if collection doesn't exist
      setRecords([
        { id: "1", customerName: "Darty Tech", amountOwed: 55000, deposited: 20000, balance: 35000, description: "Bulk order of Gadgets", date: new Date().toISOString(), status: "pending", customerContact: "08012345678", agreedPaymentDate: new Date().toISOString() },
        { id: "2", customerName: "Mog Jnr", amountOwed: 12000, deposited: 12000, balance: 0, description: "Cables and Chargers", date: new Date().toISOString(), status: "paid" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const checkAutomatedReminders = (data: DebtRecord[]) => {
    const today = new Date();
    data.forEach(record => {
      if (record.status !== "paid" && record.agreedPaymentDate && !record.remindedAt) {
        const paymentDate = new Date(record.agreedPaymentDate);
        if (today >= paymentDate) {
           handleSendReminder(record, 'auto');
        }
      }
    });
  };

  const handleSendReminder = async (record: DebtRecord, type: 'whatsapp' | 'sms' | 'auto' = 'whatsapp') => {
    if (!record.id || !record.customerContact) {
       if (type !== 'auto') toast.error("No contact info to send reminder.");
       return;
    }

    const message = `Hi ${record.customerName}, this is a friendly reminder from Mogshops regarding your outstanding balance of ₦${record.balance.toLocaleString()}. Please let us know when you can make the payment. Thank you!`;
    const encodedMessage = encodeURIComponent(message);

    try {
      if (type === 'whatsapp') {
        window.open(`https://wa.me/${record.customerContact.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
      } else if (type === 'sms') {
        window.open(`sms:${record.customerContact}?body=${encodedMessage}`, '_blank');
      }

      const recordRef = doc(db, "credits", record.id);
      await updateDoc(recordRef, {
        remindedAt: new Date().toISOString()
      });
      fetchRecords();
      
      if (type === 'auto') {
        toast.success(`Automated reminder recorded for ${record.customerName}!`);
      } else {
        toast.success(`Reminder opened for ${record.customerName}!`);
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
      if (type !== 'auto') toast.error("Failed to update reminder status.");
    }
  };

  const speakReminders = () => {
    const today = new Date().toLocaleDateString();
    const dueRecords = records.filter(r => 
      r.status !== "paid" && 
      r.agreedPaymentDate && 
      new Date(r.agreedPaymentDate).toLocaleDateString() === today
    );

    let text = "";
    if (dueRecords.length === 0) {
      text = "Good day Boss! No customers are scheduled to pay today.";
    } else {
      text = `Good day Boss! You have ${dueRecords.length} ${dueRecords.length === 1 ? 'customer' : 'customers'} due to pay today: ${dueRecords.map(r => r.customerName).join(', ')}.`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    toast(text, { icon: '🎙️', duration: 4000 });
  };

  const handleDebtParsed = async (data: any) => {
    try {
      const newRecord = {
        ...data,
        status: data.balance === 0 ? "paid" : "pending",
        createdAt: Timestamp.now()
      };
      await addDoc(collection(db, "credits"), newRecord);
      fetchRecords();
      toast.success("Record saved to Firestore!");
    } catch (error) {
      console.error("Error saving record:", error);
      // Even if firestore fails (e.g. no collection/rules), update local state for demo
      setRecords([ { ...data, status: data.balance === 0 ? "paid" : "pending", id: Date.now().toString() }, ...records]);
    }
  };

  const handleMarkAsPaid = async (record: DebtRecord) => {
    if (!record.id) return;
    try {
      const recordRef = doc(db, "credits", record.id);
      await updateDoc(recordRef, {
        deposited: record.amountOwed,
        balance: 0,
        status: "paid"
      });
      fetchRecords();
      toast.success("Debt marked as paid!");
    } catch (error) {
      console.error("Error updating record:", error);
      toast.error("Failed to update record.");
      // Fallback for UI if firestore fails
      setRecords(records.map(r => 
        r.id === record.id 
          ? { ...r, deposited: r.amountOwed, balance: 0, status: "paid" }
          : r
      ));
    }
  };

  const totalOutstanding = records.reduce((sum, rec) => sum + (rec.status !== "paid" ? rec.balance : 0), 0);
  const totalCollected = records.reduce((sum, rec) => sum + rec.deposited, 0);

  const filteredRecords = records.filter(rec => 
    rec.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rec.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 font-bold">Checking authentication...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl max-w-sm w-full text-center border border-gray-100 dark:border-gray-800">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Wallet size={36} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Mog Ledger</h2>
          <p className="text-sm font-medium text-gray-500 mb-8 px-4">Sign in with your admin account to manage debts and credits.</p>
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(err => toast.error(err.message))}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
             <Wallet size={24} />
          </div>
          <div>
             <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Mog Ledger App</h2>
             <p className="text-[10px] text-gray-500 font-black tracking-widest uppercase mt-1">Standalone Financial Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-2xl border border-gray-100 dark:border-gray-800">
           <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-xs">
              {user.email?.charAt(0).toUpperCase() || 'A'}
           </div>
           <span className="text-xs font-bold text-gray-600 dark:text-gray-400 hidden sm:block">{user.email}</span>
           <button 
             onClick={() => signOut(auth)}
             className="px-3 py-2 text-[10px] uppercase tracking-widest font-black text-gray-500 bg-white dark:bg-gray-950 rounded-xl hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm"
           >
             Sign Out
           </button>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Credit Ledger</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage customer debts and credit sales effortlessly.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={speakReminders}
            className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all"
          >
            <Volume2 size={18} />
            Voice Summary
          </button>
          <button className="px-6 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all">
            <TrendingUp size={18} className="text-emerald-500" />
            Report
          </button>
          <button className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="Outstanding Debt" 
          value={`₦${totalOutstanding.toLocaleString()}`} 
          trend="+12% from last month"
          icon={<AlertCircle className="text-amber-500" />}
          color="amber"
        />
        <StatsCard 
          title="Total Collected" 
          value={`₦${totalCollected.toLocaleString()}`} 
          trend="+5% from last month"
          icon={<CheckCircle2 className="text-emerald-500" />}
          color="emerald"
        />
        <StatsCard 
          title="Active Debtors" 
          value={records.filter(r => r.status !== "paid").length.toString()} 
          trend="2 new this week"
          icon={<Users className="text-blue-500" />}
          color="blue"
        />
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-gray-950 rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/20 overflow-hidden">
        {/* Filters */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search customer or item..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-500 rounded-xl hover:bg-gray-100 transition-all">
              <Filter size={20} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Description</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Total Amount</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Balance</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading ledger...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-500">No records found. Use the Mog Ledger Agent to add some!</td></tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 font-bold">
                        {record.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{record.customerName}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(record.date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        {record.customerContact && (
                          <p className="text-[10px] text-gray-500 font-medium">{record.customerContact}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 line-clamp-1">{record.description}</p>
                    {record.agreedPaymentDate && (
                      <p className="text-[10px] text-emerald-500 font-bold mt-1">
                        Pays: {new Date(record.agreedPaymentDate).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="px-8 py-6 font-bold text-gray-900 dark:text-white">
                    ₦{record.amountOwed.toLocaleString()}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-900 dark:text-white">₦{record.balance.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-emerald-500">Paid ₦{record.deposited.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-8 py-6 text-right">
                    {record.status !== "paid" ? (
                      <div className="flex items-center justify-end gap-2">
                        {record.customerContact && (
                          <>
                            <button 
                              onClick={() => handleSendReminder(record, 'whatsapp')}
                              className="p-2 text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
                              title="Send WhatsApp"
                            >
                              <MessageCircle size={16} /> WhatsApp
                            </button>
                            <button 
                              onClick={() => handleSendReminder(record, 'sms')}
                              className="p-2 text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
                              title="Send SMS"
                            >
                              <Smartphone size={16} /> SMS
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleMarkAsPaid(record)}
                          className="p-2 text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
                          title="Mark as paid"
                        >
                          <CheckCircle2 size={16} /> Mark Paid
                        </button>
                      </div>
                    ) : (
                      <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all ml-auto block">
                        <MoreVertical size={20} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Agent Overlay */}
      <CreditAIAgent onDebtParsed={handleDebtParsed} />
    </div>
  );
}

function StatsCard({ title, value, trend, icon, color }: any) {
  const colorClasses: any = {
    amber: "bg-amber-50 dark:bg-amber-900/10 text-amber-600",
    emerald: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600",
    blue: "bg-blue-50 dark:bg-blue-900/10 text-blue-600",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-6 bg-white dark:bg-gray-950 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-lg shadow-gray-200/10 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
          <ArrowUpRight size={12} />
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white">{value}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}
